import {
  appLog,
  bindDownloadsToAccount,
  createAppContext,
  createNativeSqlDatabase,
  PROFILE_PREFS_KEY,
  type BackupStorages,
  type KeyValueStorage,
} from '@iptv/shared';
import { appConfig } from './config';
import { desktop } from './desktop';
import { createCacheChunkStore, createMemoryChunkStore } from './offline/chunkStore';
import { createDownloadsStore } from './offline/downloadsStore';
import { createOfflineDb } from './offline/offlineDb';
import { createUiStore } from './ui/uiStore';

/** localStorage adapter. Keys are prefixed with the app slug so several apps on one origin do not collide. */
function createWebStorage(prefix: string): KeyValueStorage {
  const key = (name: string) => `${prefix}:${name}`;
  return {
    getItem: (name) => window.localStorage.getItem(key(name)),
    setItem: (name, value) => window.localStorage.setItem(key(name), value),
    removeItem: (name) => window.localStorage.removeItem(key(name)),
  };
}

const offlineSupported = 'serviceWorker' in navigator && 'caches' in window && 'indexedDB' in window && !!window.crypto?.subtle;

/**
 * The page talks to the IPTV provider directly, like the TV app (D-038, D-071, D-088). In the desktop app, sign-in and
 * password are encrypted by the operating system and the library goes to files; the app sets the provider User-Agent
 * itself, so none is sent from the page. In a plain browser (development and the end-to-end tests only: providers do
 * not let a web page read their answers) both live in localStorage.
 */
export const storage = desktop ? desktop.secure : createWebStorage(appConfig.appSlug);
const dataStorage = desktop ? desktop.data : createWebStorage(`${appConfig.appSlug}-data`);
// The desktop app keeps the library in SQLite (D-121), like the TV app; a browser keeps it in memory.
const libraryDb = desktop ? createNativeSqlDatabase(desktop.db) : undefined;
export const appContext = createAppContext({ config: appConfig, storage, direct: { dataStorage, libraryDb } });
export const { stores, api } = appContext;

/** What the user-data backup reads and writes (D-056). */
export const backupStorages: BackupStorages = { secure: storage, data: dataStorage, settingsKeys: [PROFILE_PREFS_KEY] };

export const downloadsStore = createDownloadsStore({
  api,
  supported: offlineSupported,
  db: createOfflineDb(offlineSupported ? indexedDB : undefined),
  chunks: offlineSupported ? createCacheChunkStore(caches, location.origin) : createMemoryChunkStore(),
  storage: navigator.storage,
});

/** Downloads belong to the signed-in account; `signOut` removes them first (D-050). */
export const { signOut } = bindDownloadsToAccount({
  session: stores.session,
  storage,
  async removeAll() {
    await downloadsStore.getState().init();
    for (const id of Object.keys(downloadsStore.getState().records)) await downloadsStore.getState().remove(id);
  },
});

export const uiStore = createUiStore();

// Diagnostics log (account menu → App → Log, D-079): kept across reloads in its own storage, outside the backup.
void appLog
  .persist(createWebStorage(`${appConfig.appSlug}-log`))
  .then(() =>
    appLog.info(
      'app',
      `${appConfig.appName} started: ${desktop ? `desktop app ${desktop.version} on ${desktop.platform}` : `web, ${navigator.userAgent}`}`,
    ),
  )
  .catch(() => undefined);
window.addEventListener('error', (event) => appLog.error('app', `uncaught: ${event.message}`));
window.addEventListener('unhandledrejection', (event) => appLog.error('app', `unhandled rejection: ${String(event.reason)}`));
