import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import type { ProfileDto, ProgressDto, WatchlistDto } from '../api/types';
import { collectUserData, type BackupStorages, type UserDataContents } from '../backup/userData';
import { CREDENTIALS_KEY, profilesKey, progressKey, watchlistKey } from '../direct/directApiClient';
import { CONNECTION_STORAGE_KEY } from '../stores/connectionStore';
import { pinStorageKey } from '../stores/pinStore';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import { asciiJson, fromAscii, fromBase64, parseJson, randomBytes, toBase64 } from '../utils/bytes';

/**
 * Phone-to-TV pairing (D-060). The TV shows a QR code with its address on the home network and a one-time key. The
 * phone app scans it and sends its sign-in and media data (profiles, progress, My List), encrypted with that key. The
 * TV signs in with it (when signed out) or merges it (same account), and answers with the merged media data, so both
 * devices end up with the same lists. Device settings (the audio decoder choice) are never sent.
 */
export const PAIRING_PATH = '/pair';
const QR_PREFIX = 'IPTVPAIR:1:';
const MAX_WATCHLIST = 500;

export interface PairingOffer {
  host: string;
  port: number;
  /** 32 random bytes, base64. Made by the TV (native SecureRandom). */
  key: string;
}

/** Text for the QR code. Short and upper-case where possible, so the code stays small. */
export const pairingQrText = ({ host, port, key }: PairingOffer) =>
  `${QR_PREFIX}${host}:${port}:${key.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

export function parsePairingQr(text: string): PairingOffer | null {
  if (!text.startsWith(QR_PREFIX)) return null;
  const match = /^([\d.]+):(\d{1,5}):([A-Za-z0-9_-]{43})$/.exec(text.slice(QR_PREFIX.length));
  if (!match) return null;
  const key = match[3]!.replace(/-/g, '+').replace(/_/g, '/') + '=';
  return { host: match[1]!, port: Number(match[2]), key };
}

export type PairingMode = 'login' | 'sync';
export type PairingError = 'other-account' | 'not-signed-in' | 'bad-request';

/** What the phone sends. */
interface PairingRequest {
  contents: UserDataContents;
}
/** What the TV answers. */
type PairingReply = { ok: true; mode: PairingMode; data: Record<string, string> } | { ok: false; error: PairingError };

/** Result on either side, for the UI. */
export type PairingResult = { ok: true; mode: PairingMode; accountName: string } | { ok: false; error: PairingError };

export function pairingMessage(error: PairingError | 'unreachable' | 'wrong-code'): string {
  switch (error) {
    case 'other-account':
      return 'The TV is signed in to a different account. Sign out on the TV first, then scan again.';
    case 'not-signed-in':
      return 'Sign in on the phone first.';
    case 'bad-request':
    case 'wrong-code':
      return 'This code is no longer valid. Open the QR code on the TV again and scan the new one.';
    case 'unreachable':
      return 'Could not reach the TV. Phone and TV must be on the same home network (Wi-Fi).';
  }
}

function seal(key: string, value: unknown): string {
  const nonce = randomBytes(24);
  const bytes = Uint8Array.from(asciiJson(value), (c) => c.charCodeAt(0));
  return JSON.stringify({ nonce: toBase64(nonce), data: toBase64(xchacha20poly1305(fromBase64(key), nonce).encrypt(bytes)) });
}

/** `null` when the text was not sealed with this key (wrong or old code, or changed on the way). */
function unseal<T>(key: string, text: string): T | null {
  try {
    const { nonce, data } = JSON.parse(text) as { nonce: string; data: string };
    return JSON.parse(fromAscii(xchacha20poly1305(fromBase64(key), fromBase64(nonce)).decrypt(fromBase64(data)))) as T;
  } catch {
    return null;
  }
}

interface Session {
  token?: string;
  account?: { id: string; username?: string };
  profiles?: ProfileDto[];
  activeProfileId?: string | null;
}
type StoredProfile = ProfileDto & { createdAt?: string };

export interface MediaState {
  profiles: StoredProfile[];
  progress: Record<string, ProgressDto[]>;
  watchlist: Record<string, WatchlistDto[]>;
}

const sameName = (a: StoredProfile, b: StoredProfile) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

/**
 * Merges two devices' media data for one account. Profiles match by id, else by name (each device creates a profile
 * named after the provider login on first sign-in); `incoming` keeps its ids and details, profiles only on `local` are
 * added. Progress: per title the most recent. My List: both lists together (the earlier "added" date wins). A title
 * removed on one device but still listed on the other comes back (no record of removals).
 */
export function mergeMedia(incoming: MediaState, local: MediaState): { merged: MediaState; localIds: Map<string, string> } {
  const localIds = new Map<string, string>();
  const profiles = [...incoming.profiles];
  for (const profile of local.profiles) {
    const match = incoming.profiles.find((p) => p.id === profile.id) ?? incoming.profiles.find((p) => sameName(p, profile));
    if (match) localIds.set(profile.id, match.id);
    else {
      localIds.set(profile.id, profile.id);
      profiles.push(profile);
    }
  }

  const progress: MediaState['progress'] = {};
  const watchlist: MediaState['watchlist'] = {};
  for (const { id } of profiles) {
    const localSources = local.profiles.filter((p) => localIds.get(p.id) === id).map((p) => p.id);
    const progressItems = new Map<string, ProgressDto>();
    for (const item of [...(incoming.progress[id] ?? []), ...localSources.flatMap((source) => local.progress[source] ?? [])]) {
      const key = `${item.kind}:${item.itemId}`;
      const existing = progressItems.get(key);
      if (!existing || item.updatedAt > existing.updatedAt) progressItems.set(key, item);
    }
    progress[id] = [...progressItems.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    const listItems = new Map<string, WatchlistDto>();
    for (const item of [...(incoming.watchlist[id] ?? []), ...localSources.flatMap((source) => local.watchlist[source] ?? [])]) {
      const key = `${item.section}:${item.masterId}`;
      const existing = listItems.get(key);
      if (!existing || item.addedAt < existing.addedAt) listItems.set(key, item);
    }
    watchlist[id] = [...listItems.values()].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1)).slice(0, MAX_WATCHLIST);
  }
  return { merged: { profiles, progress, watchlist }, localIds };
}

/** Direct mode only: in server mode profiles, progress and My List live on the server, so there is nothing to merge. */
function mediaFrom(data: Record<string, string>, accountId: string): MediaState {
  const profiles = parseJson<StoredProfile[]>(data[profilesKey(accountId)] ?? null) ?? [];
  const state: MediaState = { profiles, progress: {}, watchlist: {} };
  for (const { id } of profiles) {
    state.progress[id] = parseJson<ProgressDto[]>(data[progressKey(id)] ?? null) ?? [];
    state.watchlist[id] = parseJson<WatchlistDto[]>(data[watchlistKey(id)] ?? null) ?? [];
  }
  return state;
}

/** Storage entries for a media state. Empty when there are no profiles (server mode keeps them on the server). */
function mediaEntries(state: MediaState, accountId: string): Record<string, string> {
  if (state.profiles.length === 0) return {};
  const entries: Record<string, string> = { [profilesKey(accountId)]: JSON.stringify(state.profiles) };
  for (const { id } of state.profiles) {
    entries[progressKey(id)] = JSON.stringify(state.progress[id] ?? []);
    entries[watchlistKey(id)] = JSON.stringify(state.watchlist[id] ?? []);
  }
  return entries;
}

async function readLocalMedia(storage: BackupStorages['data'], accountId: string): Promise<Record<string, string>> {
  const data: Record<string, string> = {};
  if (!storage) return data;
  const read = async (key: string) => {
    const value = await storage.getItem(key);
    if (value !== null) data[key] = value;
  };
  await read(profilesKey(accountId));
  for (const { id } of parseJson<StoredProfile[]>(data[profilesKey(accountId)] ?? null) ?? []) {
    await read(progressKey(id));
    await read(watchlistKey(id));
  }
  return data;
}

/**
 * TV side: handles one request body sealed with `key`. Signed out → signs in with the phone's account; signed in to
 * the same account → merges. Writes the storage; the app must then call `AppContext.reload()`. `status` 403 means the
 * body was not sealed with this key (keep waiting for the real phone).
 */
export async function acceptPairing(
  storages: BackupStorages,
  key: string,
  body: string,
): Promise<{ status: number; body: string; result: PairingResult | null }> {
  const request = unseal<PairingRequest>(key, body);
  if (!request?.contents?.secure) return { status: 403, body: 'forbidden', result: null };
  const reply = (value: PairingReply, result: PairingResult) => ({ status: 200, body: seal(key, value), result });
  const fail = (error: PairingError) => reply({ ok: false, error }, { ok: false, error });

  const { secure, data = {} } = request.contents;
  const phoneSession = parseJson<Session>(secure[SESSION_STORAGE_KEY] ?? null);
  const accountId = phoneSession?.account?.id;
  if (!phoneSession?.token || !accountId) return fail('not-signed-in');

  const tvSession = parseJson<Session>(await storages.secure.getItem(SESSION_STORAGE_KEY));
  const signedIn = Boolean(tvSession?.token && tvSession.account?.id);
  if (signedIn && tvSession!.account!.id !== accountId) return fail('other-account');
  const mode: PairingMode = signedIn ? 'sync' : 'login';

  const dataStorage = storages.data ?? storages.secure;
  const local = mediaFrom(await readLocalMedia(storages.data ?? storages.secure, accountId), accountId);
  const { merged, localIds } = mergeMedia(mediaFrom(data, accountId), local);

  // Media: the merged lists under the phone's profile ids; this device's old ids that were renamed are removed.
  for (const [oldId, newId] of localIds) {
    if (oldId === newId) continue;
    await dataStorage.removeItem(progressKey(oldId));
    await dataStorage.removeItem(watchlistKey(oldId));
  }
  const entries = mediaEntries(merged, accountId);
  for (const [entryKey, value] of Object.entries(entries)) await dataStorage.setItem(entryKey, value);
  const profiles = merged.profiles.map(({ id, name, avatarKey, isKids }) => ({ id, name, avatarKey, isKids }));

  const pinKey = pinStorageKey(accountId);
  if (mode === 'login') {
    // The phone's sign-in, then the profile picker (who is watching on this TV is not the phone's choice).
    const session = { ...phoneSession, profiles: profiles.length ? profiles : phoneSession.profiles, activeProfileId: null };
    await storages.secure.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    for (const copied of [CONNECTION_STORAGE_KEY, CREDENTIALS_KEY, pinKey]) {
      if (secure[copied] !== undefined) await storages.secure.setItem(copied, secure[copied]);
    }
  } else {
    const active = tvSession!.activeProfileId ? (localIds.get(tvSession!.activeProfileId) ?? tvSession!.activeProfileId) : null;
    const session = { ...tvSession, profiles: profiles.length ? profiles : tvSession!.profiles, activeProfileId: active };
    await storages.secure.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    // A parental PIN set on the phone protects the TV too, unless the TV has its own.
    if (secure[pinKey] !== undefined && (await storages.secure.getItem(pinKey)) === null)
      await storages.secure.setItem(pinKey, secure[pinKey]);
  }

  const accountName = phoneSession.account?.username ?? 'your account';
  return reply({ ok: true, mode, data: entries }, { ok: true, mode, accountName });
}

/**
 * Phone side: sends this device's sign-in and media data to the TV in the QR code, then saves the merged media data
 * the TV answers with. The app must then call `AppContext.reload()`. Throws `PairingFailure`.
 */
export async function sendPairing(
  storages: BackupStorages,
  offer: PairingOffer,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<Extract<PairingResult, { ok: true }>> {
  let contents: UserDataContents;
  try {
    // Only sign-in and media keys: device settings (settingsKeys, e.g. the audio decoder) stay on each device.
    contents = await collectUserData({ secure: storages.secure, data: storages.data });
  } catch {
    throw new PairingFailure('not-signed-in');
  }
  const session = parseJson<Session>(contents.secure[SESSION_STORAGE_KEY] ?? null);
  const accountId = session?.account?.id;
  if (!session || !accountId) throw new PairingFailure('not-signed-in');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(`http://${offer.host}:${offer.port}${PAIRING_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: seal(offer.key, { contents } satisfies PairingRequest),
      signal: controller.signal,
    });
  } catch {
    throw new PairingFailure('unreachable');
  } finally {
    clearTimeout(timer);
  }
  const reply = response.ok ? unseal<PairingReply>(offer.key, await response.text()) : null;
  if (!reply) throw new PairingFailure('wrong-code');
  if (!reply.ok) throw new PairingFailure(reply.error);

  const dataStorage = storages.data ?? storages.secure;
  for (const [key, value] of Object.entries(reply.data)) await dataStorage.setItem(key, value);
  const profiles = parseJson<ProfileDto[]>(reply.data[profilesKey(accountId)] ?? null);
  if (profiles) {
    const updated = { ...session, profiles: profiles.map(({ id, name, avatarKey, isKids }) => ({ id, name, avatarKey, isKids })) };
    await storages.secure.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  }
  return { ok: true, mode: reply.mode, accountName: session.account?.username ?? 'your account' };
}

export class PairingFailure extends Error {
  constructor(readonly reason: PairingError | 'unreachable' | 'wrong-code') {
    super(pairingMessage(reason));
  }
}
