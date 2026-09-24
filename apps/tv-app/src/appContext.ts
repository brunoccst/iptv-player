import * as SecureStore from 'expo-secure-store';
import { createAppContext, type KeyValueStorage } from '@iptv/shared';
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
export const { stores, api } = appContext;
export const navStore = createNavStore();
export const downloadsStore = createDownloadsStore({ api, native: TvMedia });
