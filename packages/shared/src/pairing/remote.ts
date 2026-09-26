import type { PlayTarget } from '../playback/targets';
import { seal, unseal } from './sealed';

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

export type RemoteCommand = { type: 'play'; accountId: string; target: PlayTarget };
export type RemoteError = 'other-account' | 'no-profile' | 'bad-request';
type RemoteReply = { ok: true } | { ok: false; error: RemoteError };

export function remoteMessage(error: RemoteError | 'unreachable' | 'unknown-phone', tvName = 'the TV'): string {
  switch (error) {
    case 'unreachable':
      return `Could not reach ${tvName}. Open the app on the TV; phone and TV must be on the same home network (Wi-Fi).`;
    case 'unknown-phone':
      return `${tvName} does not know this phone any more. Pair again: on the TV, account menu → Sync with phone.`;
    case 'other-account':
      return `${tvName} is signed in to a different account.`;
    case 'no-profile':
      return `Choose who is watching on ${tvName} first.`;
    case 'bad-request':
      return 'Something went wrong. Try again.';
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

/**
 * Phone side: sends one command. Tries the saved address first, then the other ports of the range on the same host.
 * Resolves with the address that answered (the port may have changed after the TV app restarted).
 */
export async function sendRemoteCommand(
  tv: PairedTv,
  command: RemoteCommand,
  options: { fetch?: typeof fetch; timeoutMs?: number; now?: () => Date } = {},
): Promise<{ port: number }> {
  const body = JSON.stringify({
    phoneId: tv.phoneId,
    sealed: seal(tv.key, { command, sentAt: (options.now?.() ?? new Date()).toISOString() }),
  });
  const ports = [tv.port, ...REMOTE_PORTS.filter((port) => port !== tv.port)];
  for (const port of ports) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000);
    let response: Response;
    try {
      response = await (options.fetch ?? fetch)(`http://${tv.host}:${port}${REMOTE_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
    // Another app on this port, or an old TV app: try the next one.
    if (response.status === 404) continue;
    if (response.status === 403) throw new RemoteFailure('unknown-phone', tv.tvName);
    const reply = response.ok ? unseal<RemoteReply>(tv.key, await response.text()) : null;
    if (!reply) throw new RemoteFailure('bad-request', tv.tvName);
    if (!reply.ok) throw new RemoteFailure(reply.error, tv.tvName);
    return { port };
  }
  throw new RemoteFailure('unreachable', tv.tvName);
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
