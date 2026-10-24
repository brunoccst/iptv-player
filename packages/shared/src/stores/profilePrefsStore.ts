import { createStore } from 'zustand/vanilla';
import type { CatalogSection } from '../api/types';
import type { KeyValueStorage } from './storage';
import { t } from '../i18n/i18n';
import type { PlaybackChoices } from '../playback/playbackChoices';
import type { RecentChannel } from '../playback/recentChannels';
import type { Reminder } from '../playback/reminders';

/** Per-profile preferences kept on this device (all accounts in one entry). Not sent to the provider or the server. */
export const PROFILE_PREFS_KEY = 'settings.profiles';

export interface ProfilePrefs {
  /** Only titles with audio or subtitles in one of these languages, e.g. `['ENG', 'GER']` (D-063). Empty = all. */
  languages?: string[] | null;
  /** The single language of earlier versions; read by `profileLanguages`, replaced by `languages` on the next change. */
  language?: string | null;
  /**
   * Kids profiles: the categories a parent picked per section (D-053). A section that is absent or `null` uses the
   * name rule (D-053); an empty list shows nothing of that section.
   */
  kidsCategories?: Partial<Record<CatalogSection, string[] | null>> | null;
  /**
   * Categories hidden from browsing per section (D-110): not in the category bars, lists, Home rows or the guide;
   * search still finds their titles and channels.
   */
  hiddenCategories?: Partial<Record<CatalogSection, string[]>> | null;
  /** Series titles (master ids) with every episode watched: the tag on their covers (D-081). */
  watchedSeries?: string[] | null;
  /** The language of the app's own words for this profile (D-084), e.g. `'de'`. Absent = the device's last choice. */
  appLanguage?: string | null;
  /** The subtitles, audio track and version last picked: what every movie and series starts with (D-087). */
  playback?: PlaybackChoices | null;
  /** Live channels watched, newest first (issue #122, D-129): Home's first live row and the live player's history. */
  recentChannels?: RecentChannel[] | null;
  /** Guide programmes to be reminded of, soonest first (issue #239, D-184). */
  reminders?: Reminder[] | null;
  /**
   * When each preference was last changed here or on a synced device (ISO time, issue #268, DECISIONS.md#d-225): a sync
   * keeps the later choice. Missing for values set before.
   */
  changedAt?: Partial<Record<Exclude<keyof ProfilePrefs, 'changedAt'>, string>> | null;
}

export interface ProfilePrefsState {
  prefs: Record<string, ProfilePrefs>;
  loaded: boolean;
  load(): Promise<void>;
  update(profileId: string, patch: Partial<ProfilePrefs>): Promise<void>;
}

export function createProfilePrefsStore(storage: KeyValueStorage, now: () => Date = () => new Date()) {
  return createStore<ProfilePrefsState>()((set, get) => ({
    prefs: {},
    loaded: false,
    async load() {
      try {
        const saved = JSON.parse((await storage.getItem(PROFILE_PREFS_KEY)) ?? '{}') as Record<string, ProfilePrefs> | null;
        set({ prefs: saved && typeof saved === 'object' ? saved : {}, loaded: true });
      } catch {
        set({ prefs: {}, loaded: true });
      }
    },
    async update(profileId, patch) {
      const current = get().prefs[profileId];
      const at = now().toISOString();
      const changedAt = { ...current?.changedAt };
      for (const key of Object.keys(patch)) if (key !== 'changedAt') changedAt[key as keyof typeof changedAt] = at;
      const prefs = { ...get().prefs, [profileId]: { ...current, ...patch, changedAt } };
      set({ prefs });
      await storage.setItem(PROFILE_PREFS_KEY, JSON.stringify(prefs));
    },
  }));
}

export type ProfilePrefsStore = ReturnType<typeof createProfilePrefsStore>;

/** The profile's chosen languages; also reads the single `language` saved by earlier versions. */
export function profileLanguages(prefs: ProfilePrefs | undefined): string[] {
  if (Array.isArray(prefs?.languages)) return prefs.languages;
  return prefs?.language ? [prefs.language] : [];
}

/** Languages the title parser recognises (tags.ts), for the language choice. */
export const LANGUAGE_NAMES: Record<string, string> = {
  ENG: 'English',
  ESP: 'Spanish',
  LAT: 'Spanish (Latin America)',
  POR: 'Portuguese',
  FRE: 'French',
  GER: 'German',
  ITA: 'Italian',
  DUT: 'Dutch',
  POL: 'Polish',
  RUS: 'Russian',
  TUR: 'Turkish',
  ARA: 'Arabic',
  HIN: 'Hindi',
  JPN: 'Japanese',
  KOR: 'Korean',
  CHI: 'Chinese',
  ALB: 'Albanian',
  KUR: 'Kurdish',
  GRE: 'Greek',
  EXYU: 'Ex-Yu (Bosnian, Croatian, Serbian)',
  PAN: 'Punjabi',
};

/** The language names in the app's language (D-084), for the language choice. */
export const languageNames = (): Record<string, string> => ({
  ENG: t('English'),
  ESP: t('Spanish'),
  LAT: t('Spanish (Latin America)'),
  POR: t('Portuguese'),
  FRE: t('French'),
  GER: t('German'),
  ITA: t('Italian'),
  DUT: t('Dutch'),
  POL: t('Polish'),
  RUS: t('Russian'),
  TUR: t('Turkish'),
  ARA: t('Arabic'),
  HIN: t('Hindi'),
  JPN: t('Japanese'),
  KOR: t('Korean'),
  CHI: t('Chinese'),
  ALB: t('Albanian'),
  KUR: t('Kurdish'),
  GRE: t('Greek'),
  EXYU: t('Ex-Yu (Bosnian, Croatian, Serbian)'),
  PAN: t('Punjabi'),
});
