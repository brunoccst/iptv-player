import type { KeyValueStorage } from '../stores/storage';
import { PROFILE_PREFS_KEY, type ProfilePrefs } from '../stores/profilePrefsStore';
import { mergeReminders } from '../playback/reminders';
import { mergeDatedLists } from '../profiles/listDates';
import { SUBTITLE_SETTINGS_KEY, type SubtitleSettings } from '../subtitles/openSubtitles';
import { parseJson } from '../utils/bytes';

/**
 * The settings pairing carries besides sign-in and media (D-060): each profile's preferences (content languages, app
 * language, subtitle/audio/version choices, hidden and kids categories, watched series, recent channels, guide reminders) and the
 * automatic-subtitles settings. Where both devices have a value, the later change wins (D-225; list entries,
 * DECISIONS.md#d-229), and the phone's where neither is dated. The parental PIN goes along too (`newerPin`). What belongs to
 * the device stays: the audio decoder, the device's own app language, downloads, remote-play keys, update choices.
 */
export { PROFILE_PREFS_KEY, SUBTITLE_SETTINGS_KEY };

type PrefsByProfile = Record<string, ProfilePrefs>;

/** Preferences that are lists both devices add to: joined, not one side's. */
const JOINED = new Set<keyof ProfilePrefs>(['watchedSeries', 'recentChannels', 'reminders', 'changedAt', 'listChangedAt']);

/**
 * One profile's preferences from both devices. Each preference is the one changed later (`changedAt`, issue #268,
 * DECISIONS.md#d-225); where neither is dated (set before), the phone's (the scanning or sending device) wins, as
 * pairing always did (D-060). Kids and hidden categories go per section the same way. Watched series, reminders and
 * recent channels go per entry by their own dates (DECISIONS.md#d-229); undated entries are joined.
 */
export function mergeProfilePrefs(phone: ProfilePrefs | undefined, local: ProfilePrefs | undefined): ProfilePrefs {
  if (!phone) return { ...local };
  if (!local) return { ...phone };
  const dateOf = (prefs: ProfilePrefs, key: keyof ProfilePrefs) =>
    // The older single `language` is one choice with `languages`.
    prefs.changedAt?.[key === 'language' ? 'languages' : (key as Exclude<keyof ProfilePrefs, 'changedAt' | 'listChangedAt'>)] ?? '';
  /** Which side's value: the later date; undated on both, the phone's where it has one. */
  const phoneWins = (key: keyof ProfilePrefs) => {
    const [ours, theirs] = [dateOf(phone, key), dateOf(local, key)];
    if (ours || theirs) return ours >= theirs;
    return key === 'language' || key === 'languages'
      ? phone.languages !== undefined || phone.language !== undefined
      : phone[key] !== undefined;
  };
  const merged: ProfilePrefs = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(phone)] as (keyof ProfilePrefs)[]);
  for (const key of keys) {
    if (JOINED.has(key)) continue;
    const from = phoneWins(key) ? phone : local;
    if (from[key] !== undefined) (merged as Record<string, unknown>)[key] = from[key];
  }
  // Per section, when both chose some: the winner's sections, the other's elsewhere.
  for (const key of ['kidsCategories', 'hiddenCategories'] as const) {
    if (!phone[key] || !local[key]) continue;
    const [winner, other] = phoneWins(key) ? [phone[key], local[key]] : [local[key], phone[key]];
    (merged as Record<string, unknown>)[key] = { ...other, ...withoutUndefined(winner) };
  }
  const now = Date.now();
  Object.assign(
    merged,
    mergeDatedLists(phone, local, now, (reminders) => mergeReminders(reminders, [], now)),
  );
  if (phone.changedAt || local.changedAt) {
    const changedAt: NonNullable<ProfilePrefs['changedAt']> = { ...local.changedAt };
    for (const [key, at] of Object.entries(phone.changedAt ?? {}) as [keyof typeof changedAt, string][])
      if (at > (changedAt[key] ?? '')) changedAt[key] = at;
    merged.changedAt = changedAt;
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
