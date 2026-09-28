import { describe, expect, it } from 'vitest';
import { createAppContext } from './appContext';
import { SESSION_STORAGE_KEY } from './stores/sessionStore';
import { createMemoryStorage } from './stores/storage';
import { account, profile } from './testing/fakeBackend';

describe('app context (D-088)', () => {
  it('a login saved through a server ("My server") goes back to the login screen; the old choice is dropped', async () => {
    const storage = createMemoryStorage({
      connection: JSON.stringify({ mode: 'server', serverUrl: 'http://home-pc:5080' }),
      [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'server-token', account, profiles: [profile('p1')], activeProfileId: 'p1' }),
    });
    const { stores } = createAppContext({
      config: { appName: 'T', appSlug: 't' },
      storage,
      direct: { dataStorage: createMemoryStorage() },
    });
    await stores.session.getState().restore();
    expect(stores.session.getState().status).toBe('anonymous');
    expect(storage.data.has(SESSION_STORAGE_KEY)).toBe(false);
    expect(storage.data.has('connection')).toBe(false);
  });
});
