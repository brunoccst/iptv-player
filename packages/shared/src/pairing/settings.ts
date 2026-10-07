import type { KeyValueStorage } from '../stores/storage';
import { PROFILE_PREFS_KEY, type ProfilePrefs } from '../stores/profilePrefsStore';
import { MAX_RECENT_CHANNELS } from '../playback/recentChannels';
import { SUBTITLE_SETTINGS_KEY, type SubtitleSettings } from '../subtitles/openSubtitles';
import { parseJson } from '../utils/bytes';

/**
 * The settings pairing carries besides sign-in and media (D-162): each profile's preferences (content languages, app
 * language, subtitle/audio/version choices, hidden and kids categories, watched series, recent channels) and the
 * automatic-subtitles settings. Where both devices have a value, the phone's wins; lists are joined. What belongs to
 * the device stays: the audio decoder, the device's own app language, downloads, remote-play keys, update choices.
 */
export { PROFILE_PREFS_KEY, SUBTITLE_SETTINGS_KEY };

type PrefsByProfile = Record<string, ProfilePrefs>;

/** One profile's preferences from both devices: the phone's values first, lists joined. */
export function mergeProfilePrefs(phone: ProfilePrefs | undefined, local: ProfilePrefs | undefined): ProfilePrefs {
  if (!phone) return { ...local };
  if (!local) return { ...phone };
  const merged: ProfilePrefs = { ...local, ...withoutUndefined(phone) };
  // `languages` and the older single `language` are one choice: take both from the device that has one.
  if (phone.languages !== undefined || phone.language !== undefined) {
    merged.languages = phone.languages;
    merged.language = phone.language;
    if (merged.languages === undefined) delete merged.languages;
    if (merged.language === undefined) delete merged.language;
  }
  // Per section: the phone's where it chose, the other device's elsewhere.
  if (phone.kidsCategories && local.kidsCategories)
    merged.kidsCategories = { ...local.kidsCategories, ...withoutUndefined(phone.kidsCategories) };
  if (phone.hiddenCategories && local.hiddenCategories)
    merged.hiddenCategories = { ...local.hiddenCategories, ...withoutUndefined(phone.hiddenCategories) };
  if (phone.watchedSeries || local.watchedSeries)
    merged.watchedSeries = [...new Set([...(phone.watchedSeries ?? []), ...(local.watchedSeries ?? [])])];
  if (phone.recentChannels || local.recentChannels) {
    const phoneChannels = phone.recentChannels ?? [];
    const localOnly = (local.recentChannels ?? []).filter((c) => !phoneChannels.some((p) => p.id === c.id));
    merged.recentChannels = [...phoneChannels, ...localOnly].slice(0, MAX_RECENT_CHANNELS);
  }
  return merged;
}

const withoutUndefined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

export const readPrefs = (text: string | null | undefined): PrefsByProfile => {
  const prefs = parseJson<PrefsByProfile>(text ?? null);
  return prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? prefs : {};
};

/** The entries of `prefs` for these profile ids, as stored. Undefined when none has any. */
export function prefsFor(prefs: PrefsByProfile, profileIds: string[]): string | undefined {
  const picked = Object.fromEntries(profileIds.filter((id) => prefs[id]).map((id) => [id, prefs[id]!]));
  return Object.keys(picked).length ? JSON.stringify(picked) : undefined;
}

/**
 * The merged preferences of the account's profiles: `phone` under the merged ids, this device's under `localIds`
 * (its profile id → the merged one).
 */
export function mergePrefsByProfile(phone: PrefsByProfile, local: PrefsByProfile, localIds: Map<string, string>, profileIds: string[]) {
  const merged: PrefsByProfile = {};
  for (const id of profileIds) {
    let localPrefs: ProfilePrefs | undefined;
    for (const [oldId, newId] of localIds) {
      if (newId === id && local[oldId]) localPrefs = mergeProfilePrefs(local[oldId], localPrefs);
    }
    const prefs = mergeProfilePrefs(phone[id], localPrefs);
    if (Object.keys(prefs).length) merged[id] = prefs;
  }
  return merged;
}

/** Writes `entries` into this device's preferences, leaving other profiles (and accounts) as they are. */
export async function savePrefs(storage: KeyValueStorage, entries: PrefsByProfile, removed: string[] = []) {
  if (Object.keys(entries).length === 0 && removed.length === 0) return;
  const all = readPrefs(await storage.getItem(PROFILE_PREFS_KEY));
  for (const id of removed) delete all[id];
  await storage.setItem(PROFILE_PREFS_KEY, JSON.stringify({ ...all, ...entries }));
}

const subtitlesSet = (text: string | null | undefined) => Boolean(parseJson<Partial<SubtitleSettings>>(text ?? null)?.apiKey);

/** Automatic subtitles: the phone's settings when it has an API key, else this device's. Null when neither has one. */
export const mergeSubtitleSettings = (phone: string | null | undefined, local: string | null | undefined): string | null =>
  subtitlesSet(phone) ? phone! : subtitlesSet(local) ? local! : null;
