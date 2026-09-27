import type { ProfilePrefsStore } from '../stores/profilePrefsStore';
import type { SessionStore } from '../stores/sessionStore';
import type { KeyValueStorage } from '../stores/storage';
import { i18nStore, isUiLanguage, setUiLanguage, type UiLanguage } from './i18n';

/** The language this device used last: for sign-in and the profile picker, before a profile is chosen. */
export const UI_LANGUAGE_KEY = 'settings.uiLanguage';

/**
 * Where the app's language comes from (D-084): each profile's choice (`ProfilePrefs.appLanguage`, so a family can
 * use different languages); before a profile is open, or for a profile that never chose, the device's last choice.
 * English until anything is chosen.
 */
export function createUiLanguage({
  storage,
  session,
  profilePrefs,
}: {
  storage: KeyValueStorage;
  session: SessionStore;
  profilePrefs: ProfilePrefsStore;
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
    /** Reads the device's last choice, then the open profile's. */
    async load() {
      try {
        const saved = await storage.getItem(UI_LANGUAGE_KEY);
        if (isUiLanguage(saved)) setUiLanguage(saved);
      } catch {
        // Keep English.
      }
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
