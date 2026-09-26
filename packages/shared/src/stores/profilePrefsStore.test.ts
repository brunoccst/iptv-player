import { describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { PROFILE_PREFS_KEY, createProfilePrefsStore } from './profilePrefsStore';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';

describe('profile preferences', () => {
  it('are saved per profile and survive a restart', async () => {
    const storage = createMemoryStorage();
    const prefs = createProfilePrefsStore(storage);
    await prefs.getState().update('p1', { language: 'GER' });
    const again = createProfilePrefsStore(storage);
    await again.getState().load();
    expect(again.getState().prefs).toEqual({ p1: { language: 'GER' } });
    expect(JSON.parse(storage.data.get(PROFILE_PREFS_KEY)!)).toEqual({ p1: { language: 'GER' } });
  });

  it("the active profile's language filters library lists; changing it drops cached pages (D-063)", async () => {
    const backend = createFakeBackend();
    const [first, second] = [profile('p1'), profile('p2')];
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [first, second] });
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [], sorts: ['title'] } });
    const storage = createMemoryStorage({
      [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [first, second], activeProfileId: 'p1' }),
    });
    const { stores } = createAppContext({
      config: { appName: 'T', appSlug: 't', apiBaseUrl: 'http://api.test' },
      storage,
      fetch: backend.fetch,
    });
    await stores.session.getState().restore();
    const lastLanguage = () => backend.calls.at(-1)?.url.searchParams.get('language') ?? null;

    await stores.library.getState().loadPage('movies');
    expect(lastLanguage()).toBeNull();

    await stores.profilePrefs.getState().update('p1', { language: 'ENG' });
    expect(stores.library.getState().pages).toEqual({});
    await stores.library.getState().loadPage('movies');
    expect(lastLanguage()).toBe('ENG');

    stores.session.getState().selectProfile('p2');
    expect(stores.library.getState().pages).toEqual({});
    await stores.library.getState().loadPage('movies');
    expect(lastLanguage()).toBeNull();
  });
});
