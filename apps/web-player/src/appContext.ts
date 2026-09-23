import { createAppContext, type KeyValueStorage } from '@iptv/shared';
import { appConfig } from './config';
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

export const appContext = createAppContext({ config: appConfig, storage: createWebStorage(appConfig.appSlug) });
export const { stores, api } = appContext;

export const downloadsStore = createDownloadsStore({
  api,
  supported: offlineSupported,
  db: createOfflineDb(offlineSupported ? indexedDB : undefined),
  chunks: offlineSupported ? createCacheChunkStore(caches, location.origin) : createMemoryChunkStore(),
  storage: navigator.storage,
});

export const uiStore = createUiStore();
