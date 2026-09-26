import { createStore } from 'zustand/vanilla';
import type { CatalogSection } from '../api/types';
import type { KeyValueStorage } from './storage';

/** Per-profile preferences kept on this device (all accounts in one entry). Not sent to the provider or the server. */
export const PROFILE_PREFS_KEY = 'settings.profiles';

export interface ProfilePrefs {
  /** Only titles with this audio or subtitle language, e.g. `ENG` (D-063). Absent = all languages. */
  language?: string | null;
  /**
   * Kids profiles: the categories a parent picked per section (D-064). A section that is absent or `null` uses the
   * name rule (D-053); an empty list shows nothing of that section.
   */
  kidsCategories?: Partial<Record<CatalogSection, string[] | null>> | null;
}

export interface ProfilePrefsState {
  prefs: Record<string, ProfilePrefs>;
  loaded: boolean;
  load(): Promise<void>;
  update(profileId: string, patch: Partial<ProfilePrefs>): Promise<void>;
}

export function createProfilePrefsStore(storage: KeyValueStorage) {
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
      const prefs = { ...get().prefs, [profileId]: { ...get().prefs[profileId], ...patch } };
      set({ prefs });
      await storage.setItem(PROFILE_PREFS_KEY, JSON.stringify(prefs));
    },
  }));
}

export type ProfilePrefsStore = ReturnType<typeof createProfilePrefsStore>;

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
};
