import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { appLog, bindDownloadsToAccount, createAppContext, errorMessage, type BackupStorages, type KeyValueStorage } from '@iptv/shared';
import { TvMedia } from '../modules/tv-media';
import { appConfig, providerUserAgent } from './config';
import { fileStorage } from './dataStorage';
import { createDownloadsStore } from './downloads/downloadsStore';
import { createNavStore } from './navigation/navStore';

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
export const backupStorages: BackupStorages = { secure: secureStorage, data: fileStorage };
export const navStore = createNavStore();
export const downloadsStore = createDownloadsStore({ api, native: TvMedia });
/** Downloads belong to the signed-in account; `signOut` removes them first (D-050). */
export const { signOut } = bindDownloadsToAccount({
  session: stores.session,
  storage: secureStorage,
  removeAll: async () => downloadsStore.getState().removeAll(),
});
