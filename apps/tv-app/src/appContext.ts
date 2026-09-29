import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { I18nManager, Platform } from 'react-native';
import {
  appLog,
  batchedSha1,
  createNativeSqlDatabase,
  bindDownloadsToAccount,
  createAppContext,
  defaultDeviceLanguages,
  errorMessage,
  PROFILE_PREFS_KEY,
  type BackupStorages,
  type KeyValueStorage,
  withUserDatabase,
} from '@iptv/shared';
import { TvMedia } from '../modules/tv-media';
import { appConfig, providerUserAgent, updateRepo } from './config';
import { fileStorage } from './dataStorage';
import { logStartup } from './startupLog';
import { createDownloadsStore } from './downloads/downloadsStore';
import { createNavStore } from './navigation/navStore';
import { createPlaybackSettings, PLAYBACK_SETTINGS_KEY } from './playbackSettings';
import { createUpdater } from './update/updates';

/** Android Keystore-encrypted storage. Session token must not sit in plain files. */
const keystoreStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/** The phone's or TV's language (Android settings), for the app's language on a first start (D-084). */
function deviceLanguages(): string[] {
  const locale = (I18nManager.getConstants?.() as { localeIdentifier?: string } | undefined)?.localeIdentifier;
  return [locale?.replace('_', '-'), ...defaultDeviceLanguages()].filter((tag): tag is string => !!tag);
}

// The library in Android's own SQLite (D-121): a start reads a few rows, not 35 MB, and each list is a query.
const libraryDb = createNativeSqlDatabase({
  run: (statements) => TvMedia.dbRun(statements),
  query: (sql, params) => TvMedia.dbQuery(sql, params),
});
// Profiles, progress, My List, settings and the PIN in the same database (D-126); the sign-in stays in the Keystore.
const { secure: secureStorage, data: dataStorage } = withUserDatabase({ secure: keystoreStorage, data: fileStorage }, libraryDb);

export const appContext = createAppContext({
  config: appConfig,
  storage: secureStorage,
  // Lists are read by native code on another thread (D-115): in JavaScript it took minutes on a Chromecast.
  direct: {
    dataStorage,
    userAgent: providerUserAgent,
    listReader: {
      open: (url, headers, timeoutMs, batchChars) => TvMedia.openList(url, headers, timeoutMs, batchChars),
      next: (id) => TvMedia.readList(id),
      close: (id) => TvMedia.closeList(id),
    },
    // Title ids hashed by native code: in JavaScript they took about a minute for 110k titles on a TV (D-118).
    hashIds: batchedSha1((joined) => TvMedia.sha1Batch(joined)),
    libraryDb,
  },
  deviceLanguages,
});
TvMedia.setUserAgent(providerUserAgent);

// CI builds (APP_TV_DEBUG_REMOTE) also print the diagnostics log to logcat, so emulator runs show it (D-093).
if (Constants.expoConfig?.extra?.APP_TV_DEBUG_REMOTE === '1') {
  for (const level of ['info', 'warn', 'error'] as const) {
    const write = appLog[level];
    appLog[level] = (area, message) => {
      console.log(`[appLog] ${level} [${area}] ${message}`);
      write(area, message);
    };
  }
}

// Diagnostics log (Log screen → Share): kept across restarts; uncaught JS errors are recorded before the app dies.
void appLog
  .persist(fileStorage)
  .then(() =>
    appLog.info(
      'app',
      `${appConfig.appName} started on Android ${Platform.Version}, FFmpeg audio ${TvMedia.ffmpegAudioAvailable() ? 'bundled' : 'not bundled'}`,
    ),
  )
  // The device's memory and the native crash of the last run, if any (D-113).
  .then(logStartup);
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
  data: dataStorage,
  settingsKeys: [PLAYBACK_SETTINGS_KEY, PROFILE_PREFS_KEY],
};
export const navStore = createNavStore();
/** Self-update from the GitHub release (D-062); off when the build has no `APP_UPDATE_REPO`. */
export const updater = createUpdater({ repo: updateRepo, storage: fileStorage });
export const playbackSettings = createPlaybackSettings(dataStorage);
void playbackSettings.getState().load();
export const downloadsStore = createDownloadsStore({ api, native: TvMedia });
/** Downloads belong to the signed-in account; `signOut` removes them first (D-050). */
export const { signOut } = bindDownloadsToAccount({
  session: stores.session,
  storage: secureStorage,
  removeAll: async () => downloadsStore.getState().removeAll(),
});
