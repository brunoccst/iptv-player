import type { PlayTarget } from '../playback/targets';
import { seal, unseal } from './sealed';
import { t } from '../i18n/i18n';

/**
 * Remote play (D-061): after pairing (D-060), the phone app can start a title on the TV. While the TV app runs it
 * listens on the home network (a fixed port range); each paired phone has its own key, handed over in the encrypted
 * pairing answer. Commands are sealed with that key and must be fresh, so a recorded request cannot be replayed later.
 */
export const REMOTE_PATH = '/remote';
/** The TV takes the first free port of these; a phone tries its saved port first, then these. */
export const REMOTE_PORTS = [38127, 38128, 38129, 38130, 38131];
/** Commands older than this are refused (replays). Phone and TV clocks come from the network, so they agree closely. */
const MAX_COMMAND_AGE_MS = 5 * 60_000;

/** What the TV hands a phone during pairing. */
export interface RemoteOffer {
  tvId: string;
  tvName: string;
  /** This phone's id on the TV, sent with every command so the TV knows which key to use. */
  phoneId: string;
  /** 32 random bytes, base64. */
  key: string;
  port: number;
  /**
   * The device that listens: a TV, or since 3.1 a computer (the desktop app, issue #268, DECISIONS.md#d-240). Absent
   * from older apps: a TV. A phone keeps one of each and syncs with both; Play on TV goes to the TV only.
   */
  kind?: 'tv' | 'computer';
}

/** Saved on the phone. */
export interface PairedTv extends RemoteOffer {
  host: string;
  pairedAt: string;
}

/** Saved on the TV, one per paired phone. */
export interface PairedPhone {
  phoneId: string;
  key: string;
  pairedAt: string;
}

/**
 * `log`: the TV answers with its diagnostics log, masked, so the phone can share it (D-039). `sync`: the phone's
 * profiles, progress and My List; the TV merges them and answers with the merged entries (issue #227).
 */
export type RemoteCommand =
  | { type: 'play'; accountId: string; target: PlayTarget }
  | { type: 'log' }
  | { type: 'sync'; accountId: string; data: Record<string, string> };
export type RemoteError = 'other-account' | 'no-profile' | 'bad-request';
export type RemoteReply = { ok: true; log?: string; data?: Record<string, string> } | { ok: false; error: RemoteError };

export function remoteMessage(error: RemoteError | 'unreachable' | 'unknown-phone', tvName = t('the TV')): string {
  switch (error) {
    case 'unreachable':
      return t('Could not reach {tv}. Open the app on the TV; phone and TV must be on the same home network (Wi-Fi).', { tv: tvName });
    case 'unknown-phone':
      return t('{tv} does not know this phone any more. Pair again: on the TV, account menu → Sync with another device.', { tv: tvName });
    case 'other-account':
      return t('{tv} is signed in to a different account.', { tv: tvName });
    case 'no-profile':
      return t('Choose who is watching on {tv} first.', { tv: tvName });
    case 'bad-request':
      return t('Something went wrong. Try again.');
  }
}

export class RemoteFailure extends Error {
  constructor(
    readonly reason: RemoteError | 'unreachable' | 'unknown-phone',
    tvName?: string,
  ) {
    super(remoteMessage(reason, tvName));
  }
}

/** A search for a TV that moved found nothing: no new search for it for this long (issue #268). */
const SEARCH_AGAIN_MS = 30 * 60_000;
/** Addresses asked at once while searching, and how long each may take. */
const SEARCH_PARALLEL = 32;
const SEARCH_TIMEOUT_MS = 1_000;
const searchedAt = new Map<string, number>();

/**
 * Where a TV that moved may be now (issue #268, DECISIONS.md#d-239): the router gives it another address of the same home
 * network, so the other addresses of its old one's /24, nearest first. None for a host that is not a private IPv4 one.
 */
export function neighbourHosts(host: string): string[] {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return [];
  const [a, b, c, d] = match.slice(1).map(Number) as [number, number, number, number];
  if ([a, b, c, d].some((part) => part > 255)) return [];
  const home = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  if (!home) return [];
  const others: number[] = [];
  for (let step = 1; step < 254; step++)
    for (const last of [d - step, d + step]) if (last >= 1 && last <= 254 && !others.includes(last)) others.push(last);
  return others.map((last) => `${a}.${b}.${c}.${last}`);
}

type Sent = { host: string; port: number; log?: string; data?: Record<string, string> };

/**
 * Phone side: sends one command. Tries the saved address first, then the other ports of the range on the same host.
 * When nothing answers there, looks for the TV on the other addresses of its home network (it may have got a new one
 * from the router, issue #268): only the paired TV can open the command, so the one that answers is it. Resolves with
 * the address that answered (save it when it changed) and the TV's answer.
 */
export async function sendRemoteCommand(
  tv: PairedTv,
  command: RemoteCommand,
  options: { fetch?: typeof fetch; timeoutMs?: number; now?: () => Date; search?: boolean } = {},
): Promise<Sent> {
  const body = JSON.stringify({
    phoneId: tv.phoneId,
    sealed: seal(tv.key, { command, sentAt: (options.now?.() ?? new Date()).toISOString() }),
  });
  /** The TV's answer at this address; null when no paired TV answered there. */
  const at = async (host: string, port: number, timeoutMs: number, stop?: AbortSignal): Promise<Sent | null> => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    stop?.addEventListener('abort', abort);
    const timer = setTimeout(abort, timeoutMs);
    let response: Response;
    try {
      response = await (options.fetch ?? fetch)(`http://${host}:${port}${REMOTE_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      stop?.removeEventListener('abort', abort);
    }
    // Another app on this port, or an old TV app: try the next one.
    if (response.status === 404) return null;
    if (response.status === 403) throw new RemoteFailure('unknown-phone', tv.tvName);
    const reply = response.ok ? unseal<RemoteReply>(tv.key, await response.text()) : null;
    if (!reply) throw new RemoteFailure('bad-request', tv.tvName);
    if (!reply.ok) throw new RemoteFailure(reply.error, tv.tvName);
    return { host, port, log: reply.log, data: reply.data };
  };
  const ports = [tv.port, ...REMOTE_PORTS.filter((port) => port !== tv.port)];
  for (const port of ports) {
    const sent = await at(tv.host, port, options.timeoutMs ?? 5_000);
    if (sent) return sent;
  }
  const now = options.now?.().getTime() ?? Date.now();
  const last = searchedAt.get(tv.tvId);
  if (options.search === false || (last !== undefined && now - last < SEARCH_AGAIN_MS)) throw new RemoteFailure('unreachable', tv.tvName);
  // Another device's TV refuses the command (403) as an unknown phone: on the search that only means "not this one".
  const candidates = neighbourHosts(tv.host).flatMap((host) => [...new Set([tv.port, REMOTE_PORTS[0]!])].map((port) => ({ host, port })));
  const found = new AbortController();
  let next = 0;
  const search: { result: Sent | null } = { result: null };
  const worker = async () => {
    while (!search.result && next < candidates.length) {
      const { host, port } = candidates[next++]!;
      try {
        const sent = await at(host, port, SEARCH_TIMEOUT_MS, found.signal);
        if (sent && !search.result) {
          search.result = sent;
          found.abort();
        }
      } catch (error) {
        if (!(error instanceof RemoteFailure) || error.reason !== 'unknown-phone') {
          // It is the TV (it opened the command), and it refused it.
          if (!search.result) throw error;
        }
      }
    }
  };
  const outcomes = await Promise.allSettled(Array.from({ length: SEARCH_PARALLEL }, worker));
  if (search.result) {
    searchedAt.delete(tv.tvId);
    return search.result;
  }
  const refused = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (refused) throw refused.reason;
  searchedAt.set(tv.tvId, now);
  throw new RemoteFailure('unreachable', tv.tvName);
}

/** For tests: search again at once. */
export function resetTvSearch() {
  searchedAt.clear();
}

/**
 * TV side: opens a request from a paired phone. `null` (answer 403) when no paired phone sealed it, or when it is too
 * old. `reply` seals the answer with that phone's key.
 */
export function openRemoteRequest(
  phones: PairedPhone[],
  body: string,
  now: Date = new Date(),
): { phone: PairedPhone; command: RemoteCommand; reply(result: RemoteReply): string } | null {
  let request: { phoneId?: string; sealed?: string };
  try {
    request = JSON.parse(body) as typeof request;
  } catch {
    return null;
  }
  const phone = phones.find((candidate) => candidate.phoneId === request.phoneId);
  if (!phone || typeof request.sealed !== 'string') return null;
  const opened = unseal<{ command: RemoteCommand; sentAt: string }>(phone.key, request.sealed);
  const sentAt = Date.parse(opened?.sentAt ?? '');
  if (!opened?.command || !(Math.abs(now.getTime() - sentAt) <= MAX_COMMAND_AGE_MS)) return null;
  return { phone, command: opened.command, reply: (result) => seal(phone.key, result) };
}
