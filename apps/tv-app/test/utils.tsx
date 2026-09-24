import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';
import { createFakeBackend, type FakeBackend } from '../../../packages/shared/src/testing/fakeBackend';
import { downloadsStore, navStore, stores } from '../src/appContext';
import { connectionStore } from '../src/hooks';
import { nativeState, playerState } from './tvMediaMock';

export const profile = { id: 'p1', name: 'Alex', avatarKey: null, isKids: false };
export const account = {
  id: 'acc-1',
  providerType: 'xtream',
  serverUrl: 'http://panel/',
  username: 'demo',
  status: 'Active',
  expiresAt: null,
  maxConnections: 1,
};

/** Fresh fake backend on global fetch, signed-in session, empty caches. Server mode ("My server" at http://api.test). */
export function setupApp(options: { signedIn?: boolean } = {}): FakeBackend {
  const backend = createFakeBackend();
  globalThis.fetch = backend.fetch;
  connectionStore.setState({ mode: 'server', serverUrl: 'http://api.test', loaded: true });
  void SecureStore.setItemAsync('connection', JSON.stringify({ mode: 'server', serverUrl: 'http://api.test' }));
  backend.on('GET', '/api/profiles/p1/progress', { body: [] });
  if (options.signedIn === false) void SecureStore.deleteItemAsync('session');
  else {
    // App.restore() re-validates the stored session on mount.
    void SecureStore.setItemAsync('session', JSON.stringify({ token: 'tok', account, profiles: [profile], activeProfileId: 'p1' }));
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [profile] });
  }
  nativeState.reset();
  playerState.reset();
  stores.library.getState().reset();
  stores.catalog.getState().reset();
  stores.epg.getState().reset();
  stores.progress.getState().reset();
  downloadsStore.setState({ records: {}, errors: {} });
  navStore.setState({ stack: [{ name: 'section', section: 'home' }] });
  stores.session.setState(
    options.signedIn === false
      ? { status: 'anonymous', token: null, account: null, profiles: [], activeProfileId: null, error: null, busy: false }
      : { status: 'authenticated', token: 'tok', account, profiles: [profile], activeProfileId: 'p1', error: null, busy: false },
  );
  return backend;
}

export const variant = (streamId: string, label: string, container = 'mkv') => ({
  streamId,
  label,
  quality: null,
  source: null,
  audioLanguages: [],
  audioTag: null,
  isHdr: false,
  containerExtension: container,
  categoryId: null,
  rawTitle: label,
});

export const playback = (url: string, container = 'mkv') => ({ url, container, isLive: false, deliveryMode: 'relay' });

/** Simulates the remote's Back button (BackHandler listens to this device event). */
export function pressBack() {
  DeviceEventEmitter.emit('hardwareBackPress');
}
