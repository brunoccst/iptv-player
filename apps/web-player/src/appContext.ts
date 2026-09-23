import { createAppContext, type KeyValueStorage } from '@iptv/shared';
import { appConfig } from './config';

/** localStorage adapter. Keys are prefixed with the app slug so several apps on one origin do not collide. */
function createWebStorage(prefix: string): KeyValueStorage {
  const key = (name: string) => `${prefix}:${name}`;
  return {
    getItem: (name) => window.localStorage.getItem(key(name)),
    setItem: (name, value) => window.localStorage.setItem(key(name), value),
    removeItem: (name) => window.localStorage.removeItem(key(name)),
  };
}

export const appContext = createAppContext({ config: appConfig, storage: createWebStorage(appConfig.appSlug) });
export const { stores, api } = appContext;
