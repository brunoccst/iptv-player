import type { ProfileDto, ProgressDto, WatchlistDto } from '../api/types';
import { collectUserData, type BackupStorages, type UserDataContents } from '../backup/userData';
import { CREDENTIALS_KEY, profilesKey, progressKey, watchlistKey } from '../direct/directApiClient';
import { emptyRemovals, pruneRemovals, readRemovals, removalsKey, type Removals } from '../direct/removals';
import { pinStorageKey } from '../stores/pinStore';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import { parseJson } from '../utils/bytes';
import { seal, unseal } from './sealed';
import {
  mergePrefsByProfile,
  mergeSubtitleSettings,
  PROFILE_PREFS_KEY,
  prefsFor,
  readPrefs,
  savePrefs,
  SUBTITLE_SETTINGS_KEY,
} from './settings';
import type { RemoteOffer } from './remote';
import { t } from '../i18n/i18n';
import type { ProfilePrefs } from '../stores/profilePrefsStore';

/**
 * Device pairing (D-060). Every app shows a QR code with its address on the home network and a one-time key; apps on
 * devices with a camera can also scan one (D-178). The scanning device sends its sign-in and media data (profiles,
 * progress, My List), encrypted with that key. The device showing the code signs in with it (when signed out) or merges
 * it (same account), and answers with the merged media data, so both devices end up with the same lists. A scanning
 * device that is signed out gets the other device's sign-in instead ('share', D-178). The profiles' preferences and
 * the automatic-subtitles settings go along too (D-060, `settings.ts`). Device settings (the audio decoder choice) are
 * never sent.
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

/** 'login': the device showing the code was signed in; 'share': the scanning device was (D-178). */
export type PairingMode = 'login' | 'sync' | 'share';
export type PairingError = 'other-account' | 'not-signed-in' | 'bad-request';

/** What the phone sends. */
interface PairingRequest {
  contents: UserDataContents;
}
/** What the TV answers. */
type PairingReply =
  | {
      ok: true;
      mode: PairingMode;
      data: Record<string, string>;
      settings?: PairedSettings;
      remote?: RemoteOffer;
      /** 'share' (D-178): the sign-in for the scanning device, and the account name to show there. */
      secure?: Record<string, string>;
      accountName?: string;
    }
  | { ok: false; error: PairingError };
/**
 * The merged settings (D-060), apart from `data` so an older phone, which writes `data` as it is, never replaces its
 * preferences of other accounts with this account's.
 */
interface PairedSettings {
  /** Preferences by merged profile id. */
  prefs: Record<string, ProfilePrefs>;
  /** Automatic subtitles (`SubtitleSettings` as stored), or null when neither device has them. */
  subtitles: string | null;
}

/** Result on either side, for the UI. `remote`: the remote-play key both devices keep (D-061). */
export type PairingResult = { ok: true; mode: PairingMode; accountName: string; remote?: RemoteOffer } | { ok: false; error: PairingError };

export function pairingMessage(error: PairingError | 'unreachable' | 'wrong-code'): string {
  switch (error) {
    case 'other-account':
      return t('The other device is signed in to a different account. Sign out on one of them first, then scan again.');
    case 'not-signed-in':
      return t('Sign in on one of the two devices first.');
    case 'bad-request':
    case 'wrong-code':
      return t('This code is no longer valid. Open the QR code on the other device again and scan the new one.');
    case 'unreachable':
      return t(
        'Could not reach the other device. Both must be on the same home network (Wi-Fi or cable). On a computer, allow the app on private networks if the firewall asks.',
      );
  }
}

interface Session {
  token?: string;
  account?: { id: string; username?: string };
  profiles?: ProfileDto[];
  activeProfileId?: string | null;
}
type StoredProfile = ProfileDto & { createdAt?: string; updatedAt?: string };

export interface MediaState {
  profiles: StoredProfile[];
  progress: Record<string, ProgressDto[]>;
  watchlist: Record<string, WatchlistDto[]>;
  /** What was removed and when (issue #227); missing from older apps. */
  removals?: Removals;
}

const sameName = (a: StoredProfile, b: StoredProfile) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
const later = (a: string | undefined, b: string | undefined) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * Merges two devices' media data for one account. Profiles match by id, else by name (each device creates a profile
 * named after the provider login on first sign-in); `incoming` keeps its ids, and the details of the profile edited
 * last (issue #227); profiles only on `local` are added. Progress: per title the most recent. My List: both lists
 * together (the earlier "added" date wins). Removals (DECISIONS.md#d-186) win over entries saved before them on
 * either device: a deleted profile, progress taken off Continue watching and a title taken off My List stay gone.
 */
export function mergeMedia(
  incoming: MediaState,
  local: MediaState,
  now = new Date(),
): { merged: MediaState; localIds: Map<string, string> } {
  const incomingRemovals = incoming.removals ?? emptyRemovals();
  const localRemovals = local.removals ?? emptyRemovals();
  const removedProfiles: Record<string, string> = { ...incomingRemovals.profiles };
  for (const [id, at] of Object.entries(localRemovals.profiles)) removedProfiles[id] = later(removedProfiles[id], at)!;
  // A profile created after it was deleted elsewhere (same id: never; kept for safety) stays.
  const alive = (profile: StoredProfile) => !removedProfiles[profile.id] || (profile.createdAt ?? '') > removedProfiles[profile.id]!;
  // Never remove every profile: an account always has one.
  const keepAll = ![...incoming.profiles, ...local.profiles].some(alive);
  const incomingProfiles = keepAll ? incoming.profiles : incoming.profiles.filter(alive);
  const localProfiles = keepAll ? local.profiles : local.profiles.filter(alive);

  const localIds = new Map<string, string>();
  const profiles = [...incomingProfiles];
  for (const profile of localProfiles) {
    const index = incomingProfiles.findIndex((p) => p.id === profile.id);
    const match = index >= 0 ? index : incomingProfiles.findIndex((p) => sameName(p, profile));
    if (match >= 0) {
      const kept = profiles[match]!;
      localIds.set(profile.id, kept.id);
      // Edited later on this device: its name, picture and Kids choice, under the incoming id.
      if (profile.updatedAt && profile.updatedAt > (kept.updatedAt ?? '')) {
        const { name, avatarKey, isKids, updatedAt } = profile;
        profiles[match] = { ...kept, name, avatarKey, isKids, updatedAt };
      }
    } else {
      localIds.set(profile.id, profile.id);
      profiles.push(profile);
    }
  }

  const progress: MediaState['progress'] = {};
  const watchlist: MediaState['watchlist'] = {};
  const removals: Removals = { profiles: removedProfiles, progress: {}, watchlist: {} };
  for (const { id } of profiles) {
    const localSources = localProfiles.filter((p) => localIds.get(p.id) === id).map((p) => p.id);
    const removedOf = (list: 'progress' | 'watchlist') => {
      const entries: Record<string, string> = { ...(incomingRemovals[list][id] ?? {}) };
      for (const source of localSources)
        for (const [key, at] of Object.entries(localRemovals[list][source] ?? {})) entries[key] = later(entries[key], at)!;
      return entries;
    };
    const removedProgress = removedOf('progress');
    const removedList = removedOf('watchlist');
    if (Object.keys(removedProgress).length) removals.progress[id] = removedProgress;
    if (Object.keys(removedList).length) removals.watchlist[id] = removedList;

    const progressItems = new Map<string, ProgressDto>();
    for (const item of [...(incoming.progress[id] ?? []), ...localSources.flatMap((source) => local.progress[source] ?? [])]) {
      const key = `${item.kind}:${item.itemId}`;
      if (removedProgress[key] && item.updatedAt <= removedProgress[key]) continue;
      const existing = progressItems.get(key);
      if (!existing || item.updatedAt > existing.updatedAt) progressItems.set(key, item);
    }
    progress[id] = [...progressItems.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    const listItems = new Map<string, WatchlistDto>();
    for (const item of [...(incoming.watchlist[id] ?? []), ...localSources.flatMap((source) => local.watchlist[source] ?? [])]) {
      const key = `${item.section}:${item.masterId}`;
      if (removedList[key] && item.addedAt <= removedList[key]) continue;
      const existing = listItems.get(key);
      if (!existing || item.addedAt < existing.addedAt) listItems.set(key, item);
    }
    watchlist[id] = [...listItems.values()].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1)).slice(0, MAX_WATCHLIST);
  }
  return { merged: { profiles, progress, watchlist, removals: pruneRemovals(removals, now) }, localIds };
}

/** Profiles, progress and My List live on each device, so pairing merges them. */
function mediaFrom(data: Record<string, string>, accountId: string): MediaState {
  const profiles = parseJson<StoredProfile[]>(data[profilesKey(accountId)] ?? null) ?? [];
  const state: MediaState = { profiles, progress: {}, watchlist: {}, removals: readRemovals(data[removalsKey(accountId)]) };
  for (const { id } of profiles) {
    state.progress[id] = parseJson<ProgressDto[]>(data[progressKey(id)] ?? null) ?? [];
    state.watchlist[id] = parseJson<WatchlistDto[]>(data[watchlistKey(id)] ?? null) ?? [];
  }
  return state;
}

/** Storage entries for a media state. Empty when there are no profiles. */
function mediaEntries(state: MediaState, accountId: string): Record<string, string> {
  if (state.profiles.length === 0) return {};
  const entries: Record<string, string> = { [profilesKey(accountId)]: JSON.stringify(state.profiles) };
  for (const { id } of state.profiles) {
    entries[progressKey(id)] = JSON.stringify(state.progress[id] ?? []);
    entries[watchlistKey(id)] = JSON.stringify(state.watchlist[id] ?? []);
  }
  if (state.removals) entries[removalsKey(accountId)] = JSON.stringify(state.removals);
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
  await read(removalsKey(accountId));
  for (const { id } of parseJson<StoredProfile[]>(data[profilesKey(accountId)] ?? null) ?? []) {
    await read(progressKey(id));
    await read(watchlistKey(id));
  }
  return data;
}

const sessionProfiles = (state: MediaState): ProfileDto[] =>
  state.profiles.map(({ id, name, avatarKey, isKids }) => ({ id, name, avatarKey, isKids }));

/** The saved session with the merged profiles; the open profile follows a new id, and closes when it was deleted. */
function mergedSession(session: Session, profiles: ProfileDto[], localIds: Map<string, string>): Session {
  if (!profiles.length) return session;
  const id = session.activeProfileId;
  // No profiles saved here (none to match): the id stays.
  const open = id ? (localIds.size ? (localIds.get(id) ?? null) : id) : null;
  return { ...session, profiles, activeProfileId: open };
}

/**
 * Merges another device's media entries (`data`, as `mediaEntries` makes them) into this device's and saves what
 * changed. `localIds`: this device's profile ids → merged ids; `dropped`: this device's profiles that are gone (deleted
 * on the other device, DECISIONS.md#d-186). `changed`: whether anything on this device changed.
 */
async function saveMergedMedia(
  dataStorage: NonNullable<BackupStorages['data']>,
  accountId: string,
  data: Record<string, string>,
  now = new Date(),
): Promise<{ merged: MediaState; localIds: Map<string, string>; dropped: string[]; entries: Record<string, string>; changed: boolean }> {
  const before = await readLocalMedia(dataStorage, accountId);
  const local = mediaFrom(before, accountId);
  const { merged, localIds } = mergeMedia(mediaFrom(data, accountId), local, now);
  let changed = false;
  // This device's ids that were renamed or deleted lose their lists.
  const dropped = local.profiles.map(({ id }) => id).filter((id) => !localIds.has(id));
  for (const oldId of [...dropped, ...[...localIds].filter(([oldId, newId]) => oldId !== newId).map(([oldId]) => oldId)]) {
    changed = true;
    await dataStorage.removeItem(progressKey(oldId));
    await dataStorage.removeItem(watchlistKey(oldId));
  }
  const entries = mediaEntries(merged, accountId);
  for (const [entryKey, value] of Object.entries(entries)) {
    if (before[entryKey] === value) continue;
    // The removal record alone changes nothing on screen.
    if (entryKey !== removalsKey(accountId)) changed = true;
    await dataStorage.setItem(entryKey, value);
  }
  return { merged, localIds, dropped, entries, changed };
}

/**
 * Side showing the code: handles one request body sealed with `key`. Signed out → signs in with the scanning device's
 * account; signed in to the same account → merges; scanning device signed out → hands it this device's sign-in
 * ('share', D-178). Writes the storage; the app must then call `AppContext.reload()`. `status` 403 means the body was
 * not sealed with this key (keep waiting for the real device).
 */
export async function acceptPairing(
  storages: BackupStorages,
  key: string,
  body: string,
  /** Remote play (D-061): the key for this phone, handed over in the encrypted answer. */
  options: { remote?: RemoteOffer } = {},
): Promise<{ status: number; body: string; result: PairingResult | null }> {
  const request = unseal<PairingRequest>(key, body);
  if (!request?.contents?.secure) return { status: 403, body: 'forbidden', result: null };
  const reply = (value: PairingReply, result: PairingResult) => ({ status: 200, body: seal(key, value), result });
  const fail = (error: PairingError) => reply({ ok: false, error }, { ok: false, error });

  const { secure, data = {} } = request.contents;
  const phoneSession = parseJson<Session>(secure[SESSION_STORAGE_KEY] ?? null);
  const accountId = phoneSession?.account?.id;
  const tvSession = parseJson<Session>(await storages.secure.getItem(SESSION_STORAGE_KEY));
  const signedIn = Boolean(tvSession?.token && tvSession.account?.id);
  if (!phoneSession?.token || !accountId) {
    if (!signedIn) return fail('not-signed-in');
    const shared = await shareSignIn(storages, tvSession!);
    const result: PairingResult = { ok: true, mode: 'share', accountName: shared.accountName!, remote: options.remote };
    return reply({ ...shared, remote: options.remote }, result);
  }

  if (signedIn && tvSession!.account!.id !== accountId) return fail('other-account');
  const mode: PairingMode = signedIn ? 'sync' : 'login';

  const dataStorage = storages.data ?? storages.secure;
  const { merged, localIds, dropped, entries } = await saveMergedMedia(dataStorage, accountId, data);
  const profiles = sessionProfiles(merged);

  // Settings (D-060): each profile's preferences and the automatic subtitles.
  const renamed = [...[...localIds].filter(([oldId, newId]) => oldId !== newId).map(([oldId]) => oldId), ...dropped];
  const prefs = mergePrefsByProfile(
    readPrefs(data[PROFILE_PREFS_KEY]),
    readPrefs(await dataStorage.getItem(PROFILE_PREFS_KEY)),
    localIds,
    merged.profiles.map(({ id }) => id),
  );
  await savePrefs(dataStorage, prefs, renamed);
  const localSubtitles = await storages.secure.getItem(SUBTITLE_SETTINGS_KEY);
  const subtitles = mergeSubtitleSettings(secure[SUBTITLE_SETTINGS_KEY], localSubtitles);
  if (subtitles !== null && subtitles !== localSubtitles) await storages.secure.setItem(SUBTITLE_SETTINGS_KEY, subtitles);

  const pinKey = pinStorageKey(accountId);
  if (mode === 'login') {
    // The phone's sign-in, then the profile picker (who is watching on this TV is not the phone's choice).
    const session = { ...phoneSession, profiles: profiles.length ? profiles : phoneSession.profiles, activeProfileId: null };
    await storages.secure.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    for (const copied of [CREDENTIALS_KEY, pinKey]) {
      if (secure[copied] !== undefined) await storages.secure.setItem(copied, secure[copied]);
    }
  } else {
    await storages.secure.setItem(SESSION_STORAGE_KEY, JSON.stringify(mergedSession(tvSession!, profiles, localIds)));
    // A parental PIN set on the phone protects the TV too, unless the TV has its own.
    if (secure[pinKey] !== undefined && (await storages.secure.getItem(pinKey)) === null)
      await storages.secure.setItem(pinKey, secure[pinKey]);
  }

  const accountName = phoneSession.account?.username ?? t('your account');
  const { remote } = options;
  return reply({ ok: true, mode, data: entries, settings: { prefs, subtitles }, remote }, { ok: true, mode, accountName, remote });
}

/**
 * 'share' (D-178): this device's sign-in, media data and settings for a signed-out scanning device. Who is watching
 * there is its own choice, so the profile picker opens.
 */
async function shareSignIn(storages: BackupStorages, session: Session): Promise<Extract<PairingReply, { ok: true }>> {
  const accountId = session.account!.id;
  const dataStorage = storages.data ?? storages.secure;
  const media = mediaFrom(await readLocalMedia(dataStorage, accountId), accountId);
  const profileIds = (media.profiles.length ? media.profiles : (session.profiles ?? [])).map(({ id }) => id);
  const secure: Record<string, string> = { [SESSION_STORAGE_KEY]: JSON.stringify({ ...session, activeProfileId: null }) };
  for (const key of [CREDENTIALS_KEY, pinStorageKey(accountId)]) {
    const value = await storages.secure.getItem(key);
    if (value !== null) secure[key] = value;
  }
  return {
    ok: true,
    mode: 'share',
    data: mediaEntries(media, accountId),
    settings: {
      prefs: readPrefs(prefsFor(readPrefs(await dataStorage.getItem(PROFILE_PREFS_KEY)), profileIds)),
      subtitles: await storages.secure.getItem(SUBTITLE_SETTINGS_KEY),
    },
    secure,
    accountName: session.account?.username ?? t('your account'),
  };
}

/**
 * Scanning side: sends this device's sign-in and media data to the device in the QR code, then saves the merged media
 * data it answers with. Signed out, it sends nothing and saves the other device's sign-in ('share', D-178). The app
 * must then call `AppContext.reload()`. Throws `PairingFailure`.
 */
export async function sendPairing(
  storages: BackupStorages,
  offer: PairingOffer,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<Extract<PairingResult, { ok: true }>> {
  // Sign-in and media keys; device settings (settingsKeys, e.g. the audio decoder) stay on each device. Signed out:
  // nothing, and the other device shares its sign-in (D-178).
  const contents: UserDataContents = await collectUserData({ secure: storages.secure, data: storages.data }).catch(() => ({
    secure: {},
    data: {},
  }));
  const session = parseJson<Session>(contents.secure[SESSION_STORAGE_KEY] ?? null);
  const accountId = session?.account?.id;
  const dataStorage = storages.data ?? storages.secure;

  if (session && accountId) {
    // Settings that follow the account (D-060): this account's profile preferences and the automatic subtitles.
    const profileIds = (parseJson<ProfileDto[]>(contents.data[profilesKey(accountId)] ?? null) ?? session.profiles ?? []).map(
      ({ id }) => id,
    );
    const prefs = prefsFor(readPrefs(await dataStorage.getItem(PROFILE_PREFS_KEY)), profileIds);
    if (prefs) contents.data[PROFILE_PREFS_KEY] = prefs;
    const subtitles = await storages.secure.getItem(SUBTITLE_SETTINGS_KEY);
    if (subtitles !== null) contents.secure[SUBTITLE_SETTINGS_KEY] = subtitles;
  }

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
  if (reply.mode === 'share') return saveSharedSignIn(storages, reply);
  if (!session || !accountId) throw new PairingFailure('not-signed-in');

  // Merged once more with what is saved now: progress saved while waiting for the answer stays (issue #227).
  const { merged, localIds, dropped } = await saveMergedMedia(dataStorage, accountId, reply.data);
  if (reply.settings) {
    await savePrefs(dataStorage, reply.settings.prefs, dropped);
    if (reply.settings.subtitles !== null) await storages.secure.setItem(SUBTITLE_SETTINGS_KEY, reply.settings.subtitles);
  }
  if (merged.profiles.length) {
    const saved = parseJson<Session>(await storages.secure.getItem(SESSION_STORAGE_KEY)) ?? session;
    await storages.secure.setItem(SESSION_STORAGE_KEY, JSON.stringify(mergedSession(saved, sessionProfiles(merged), localIds)));
  }
  return { ok: true, mode: reply.mode, accountName: session.account?.username ?? t('your account'), remote: reply.remote };
}

/** 'share' (D-178): signs this device in with what the other device sent. Only sign-in keys go to the secure storage. */
async function saveSharedSignIn(
  storages: BackupStorages,
  reply: Extract<PairingReply, { ok: true }>,
): Promise<Extract<PairingResult, { ok: true }>> {
  const secure = reply.secure ?? {};
  const accountId = parseJson<Session>(secure[SESSION_STORAGE_KEY] ?? null)?.account?.id;
  if (!accountId) throw new PairingFailure('wrong-code');
  const dataStorage = storages.data ?? storages.secure;
  for (const [key, value] of Object.entries(reply.data)) await dataStorage.setItem(key, value);
  if (reply.settings) {
    await savePrefs(dataStorage, reply.settings.prefs);
    if (reply.settings.subtitles !== null) await storages.secure.setItem(SUBTITLE_SETTINGS_KEY, reply.settings.subtitles);
  }
  for (const key of [CREDENTIALS_KEY, pinStorageKey(accountId), SESSION_STORAGE_KEY]) {
    if (secure[key] !== undefined) await storages.secure.setItem(key, secure[key]);
  }
  return { ok: true, mode: 'share', accountName: reply.accountName ?? t('your account'), remote: reply.remote };
}

export class PairingFailure extends Error {
  constructor(readonly reason: PairingError | 'unreachable' | 'wrong-code') {
    super(pairingMessage(reason));
  }
}

/**
 * Automatic sync (issue #227, DECISIONS.md#d-186): this device's media entries (profiles, progress, My List and what
 * was removed) for one account, as a sync with the paired TV sends them. Settings are not synced this way: they carry
 * no dates, so the newer choice cannot be told apart (they still merge when a code is scanned, D-060).
 */
export async function mediaForSync(storages: BackupStorages, accountId: string): Promise<Record<string, string>> {
  return readLocalMedia(storages.data ?? storages.secure, accountId);
}

/**
 * Either side of an automatic sync: merges the other device's media entries into this device's (`mergeMedia`), saves
 * them, and updates the saved session's profiles. Returns the merged entries (the TV answers with them) and whether
 * anything shown on this device changed (then the app refreshes its lists, `AppContext.refreshMedia`). Null when this
 * device is not signed in to `accountId`.
 */
export async function applySyncedMedia(
  storages: BackupStorages,
  accountId: string,
  data: Record<string, string>,
  now = new Date(),
): Promise<{ data: Record<string, string>; changed: boolean } | null> {
  const session = parseJson<Session>(await storages.secure.getItem(SESSION_STORAGE_KEY));
  if (!session?.token || session.account?.id !== accountId) return null;
  const dataStorage = storages.data ?? storages.secure;
  const { merged, localIds, dropped, entries, changed } = await saveMergedMedia(dataStorage, accountId, data, now);
  if (changed && merged.profiles.length) {
    const moved = [...localIds].filter(([oldId, newId]) => oldId !== newId).map(([oldId]) => oldId);
    if (moved.length || dropped.length) {
      const prefs = mergePrefsByProfile(
        {},
        readPrefs(await dataStorage.getItem(PROFILE_PREFS_KEY)),
        localIds,
        merged.profiles.map(({ id }) => id),
      );
      await savePrefs(dataStorage, prefs, [...moved, ...dropped]);
    }
    await storages.secure.setItem(SESSION_STORAGE_KEY, JSON.stringify(mergedSession(session, sessionProfiles(merged), localIds)));
  }
  return { data: entries, changed };
}
