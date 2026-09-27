import type { ProfilePrefsStore } from '../stores/profilePrefsStore';
import type { SessionStore } from '../stores/sessionStore';
import type { KeyValueStorage } from '../stores/storage';
import { defaultDeviceLanguages, i18nStore, isUiLanguage, matchUiLanguage, setUiLanguage, type UiLanguage } from './i18n';

/** The language this device used last: for sign-in and the profile picker, before a profile is chosen. */
export const UI_LANGUAGE_KEY = 'settings.uiLanguage';

/**
 * Where the app's language comes from (D-084): each profile's choice (`ProfilePrefs.appLanguage`, so a family can
 * use different languages); before a profile is open, or for a profile that never chose, the device's last choice.
 * Until anything is chosen: the device's own language when the app has it, else English.
 */
export function createUiLanguage({
  storage,
  session,
  profilePrefs,
  deviceLanguages = defaultDeviceLanguages,
}: {
  storage: KeyValueStorage;
  session: SessionStore;
  profilePrefs: ProfilePrefsStore;
  /** The device's preferred languages, first choice first (default: the browser's). */
  deviceLanguages?: () => readonly string[];
}) {
  const profileLanguage = (): UiLanguage | null => {
    const profileId = session.getState().activeProfileId;
    const chosen = profileId ? profilePrefs.getState().prefs[profileId]?.appLanguage : null;
    return isUiLanguage(chosen) ? chosen : null;
  };
  const follow = () => {
    const language = profileLanguage();
    if (language) setUiLanguage(language);
  };
  session.subscribe((state, previous) => {
    if (state.activeProfileId !== previous.activeProfileId) follow();
  });
  profilePrefs.subscribe(follow);

  return {
    store: i18nStore,
    /** Reads the device's last choice (else its own language), then the open profile's. */
    async load() {
      let saved: string | null = null;
      try {
        saved = await storage.getItem(UI_LANGUAGE_KEY);
      } catch {
        // Nothing saved: as on a first start.
      }
      // Not saved when it comes from the device: the app follows a later change of the device's language.
      const language = isUiLanguage(saved) ? saved : matchUiLanguage(safely(deviceLanguages));
      if (language) setUiLanguage(language);
      follow();
    },
    /** The user picked a language: used now, remembered for the open profile and as this device's default. */
    async choose(language: UiLanguage) {
      setUiLanguage(language);
      await storage.setItem(UI_LANGUAGE_KEY, language);
      const profileId = session.getState().activeProfileId;
      if (profileId) await profilePrefs.getState().update(profileId, { appLanguage: language });
    },
  };
}

export type UiLanguageControl = ReturnType<typeof createUiLanguage>;

function safely(read: () => readonly string[]): readonly string[] {
  try {
    return read();
  } catch {
    return [];
  }
}
