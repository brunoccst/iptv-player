import { describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { PROFILE_PREFS_KEY, createProfilePrefsStore, profileLanguages } from './profilePrefsStore';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';

describe('profile preferences', () => {
  it('are saved per profile and survive a restart', async () => {
    const storage = createMemoryStorage();
    const prefs = createProfilePrefsStore(storage);
    await prefs.getState().update('p1', { languages: ['GER', 'ENG'] });
    const again = createProfilePrefsStore(storage);
    await again.getState().load();
    expect(again.getState().prefs).toEqual({ p1: { languages: ['GER', 'ENG'] } });
    expect(JSON.parse(storage.data.get(PROFILE_PREFS_KEY)!)).toEqual({ p1: { languages: ['GER', 'ENG'] } });
  });

  it('several languages per profile; the single language of earlier versions still counts (D-067)', () => {
    expect(profileLanguages(undefined)).toEqual([]);
    expect(profileLanguages({ language: 'GER' })).toEqual(['GER']);
    expect(profileLanguages({ language: 'GER', languages: ['ENG', 'POR'] })).toEqual(['ENG', 'POR']);
    expect(profileLanguages({ language: 'GER', languages: [] })).toEqual([]);
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

    await stores.profilePrefs.getState().update('p1', { languages: ['ENG', 'GER'] });
    expect(stores.library.getState().pages).toEqual({});
    await stores.library.getState().loadPage('movies');
    expect(lastLanguage()).toBe('ENG,GER');

    stores.session.getState().selectProfile('p2');
    expect(stores.library.getState().pages).toEqual({});
    await stores.library.getState().loadPage('movies');
    expect(lastLanguage()).toBeNull();
  });

  it("a Kids profile's picked categories apply at once; cached lists are dropped (D-064)", async () => {
    const backend = createFakeBackend();
    const kid = { ...profile('kid'), isKids: true };
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [kid] });
    backend.on('GET', '/api/catalog/movies/categories', {
      body: [
        { id: 'm1', name: 'Action', kind: 'movie' },
        { id: 'm2', name: 'Kids', kind: 'movie' },
      ],
    });
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [], sorts: ['title'] } });
    const storage = createMemoryStorage({
      [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [kid], activeProfileId: 'kid' }),
    });
    const { stores } = createAppContext({
      config: { appName: 'T', appSlug: 't', apiBaseUrl: 'http://api.test' },
      storage,
      fetch: backend.fetch,
    });
    await stores.session.getState().restore();

    expect((await stores.catalog.getState().loadCategories('movies'))?.map((c) => c.id)).toEqual(['m2']);
    await stores.profilePrefs.getState().update('kid', { kidsCategories: { movies: ['m1', 'm2'] } });
    expect(stores.catalog.getState().categories).toEqual({});
    expect((await stores.catalog.getState().loadCategories('movies'))?.map((c) => c.id)).toEqual(['m1', 'm2']);
    await stores.library.getState().loadPage('movies');
    expect(backend.calls.at(-1)?.url.searchParams.get('categoryIds')).toBe('m1,m2');
  });
});
