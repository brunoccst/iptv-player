import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  appLog,
  bindDownloadsToAccount,
  createAppContext,
  errorMessage,
  PROFILE_PREFS_KEY,
  type BackupStorages,
  type KeyValueStorage,
} from '@iptv/shared';
import { TvMedia } from '../modules/tv-media';
import { appConfig, providerUserAgent, updateRepo } from './config';
import { fileStorage } from './dataStorage';
import { createDownloadsStore } from './downloads/downloadsStore';
import { createNavStore } from './navigation/navStore';
import { createPlaybackSettings, PLAYBACK_SETTINGS_KEY } from './playbackSettings';
import { createUpdater } from './update/updates';

/** Android Keystore-encrypted storage. Session token must not sit in plain files. */
const secureStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const appContext = createAppContext({
  config: appConfig,
  storage: secureStorage,
  direct: { dataStorage: fileStorage, userAgent: providerUserAgent },
});
TvMedia.setUserAgent(providerUserAgent);

// Diagnostics log (Log screen → Share): kept across restarts; uncaught JS errors are recorded before the app dies.
void appLog
  .persist(fileStorage)
  .then(() =>
    appLog.info(
      'app',
      `${appConfig.appName} started on Android ${Platform.Version}, FFmpeg audio ${TvMedia.ffmpegAudioAvailable() ? 'bundled' : 'not bundled'}`,
    ),
  );
const errorUtils = (
  globalThis as {
    ErrorUtils?: {
      getGlobalHandler(): (error: unknown, fatal?: boolean) => void;
      setGlobalHandler(handler: (error: unknown, fatal?: boolean) => void): void;
    };
  }
).ErrorUtils;
if (errorUtils) {
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, fatal) => {
    appLog.error('crash', `${fatal ? 'fatal' : 'error'}: ${errorMessage(error)}`);
    previous(error, fatal);
  });
}
export const { stores, api } = appContext;
/** What the user-data backup reads and writes (D-056). */
export const backupStorages: BackupStorages = {
  secure: secureStorage,
  data: fileStorage,
  settingsKeys: [PLAYBACK_SETTINGS_KEY, PROFILE_PREFS_KEY],
};
export const navStore = createNavStore();
/** Self-update from the GitHub release (D-062); off when the build has no `APP_UPDATE_REPO`. */
export const updater = createUpdater({ repo: updateRepo, storage: fileStorage });
export const playbackSettings = createPlaybackSettings(fileStorage);
void playbackSettings.getState().load();
export const downloadsStore = createDownloadsStore({ api, native: TvMedia });
/** Downloads belong to the signed-in account; `signOut` removes them first (D-050). */
export const { signOut } = bindDownloadsToAccount({
  session: stores.session,
  storage: secureStorage,
  removeAll: async () => downloadsStore.getState().removeAll(),
});
