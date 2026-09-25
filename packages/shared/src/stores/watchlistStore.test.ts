import { describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';
import { isOnWatchlist } from './watchlistStore';

const heat = { id: 'm1', title: 'Heat', year: 1995, posterUrl: null };

async function setup() {
  const backend = createFakeBackend();
  backend.on('GET', '/api/auth/me', { body: account });
  backend.on('GET', '/api/profiles', { body: [profile('p1')] });
  backend.on('GET', '/api/profiles/p1/progress', { body: [] });
  backend.on('GET', '/api/profiles/p1/watchlist', { body: [] });
  const storage = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [profile('p1')], activeProfileId: null }),
  });
  const { stores } = createAppContext({
    config: { appName: 'T', appSlug: 't', apiBaseUrl: 'http://api.test' },
    storage,
    fetch: backend.fetch,
  });
  await stores.session.getState().restore();
  stores.session.getState().selectProfile('p1');
  await stores.watchlist.getState().load('p1');
  return { backend, watchlist: stores.watchlist };
}

describe('watchlist store', () => {
  it('loads for the active profile and toggles titles on and off', async () => {
    const { backend, watchlist } = await setup();
    backend.on('PUT', '/api/profiles/p1/watchlist/movies/m1', ({ body }) => ({
      body: { section: 'movies', masterId: 'm1', ...(body as object), addedAt: 'x' },
    }));
    backend.on('DELETE', '/api/profiles/p1/watchlist/movies/m1', { status: 204 });

    await watchlist.getState().toggle('movies', heat);
    expect(isOnWatchlist(watchlist.getState(), 'movies', 'm1')).toBe(true);
    expect(backend.calls.at(-1)?.body).toEqual({ title: 'Heat', year: 1995, posterUrl: null });

    await watchlist.getState().toggle('movies', heat);
    expect(isOnWatchlist(watchlist.getState(), 'movies', 'm1')).toBe(false);
    expect(backend.calls.at(-1)?.method).toBe('DELETE');
  });

  it('undoes the change when saving fails', async () => {
    const { backend, watchlist } = await setup();
    backend.on('PUT', '/api/profiles/p1/watchlist/movies/m1', { status: 400, body: { detail: 'full' } });
    await watchlist.getState().toggle('movies', heat);
    expect(isOnWatchlist(watchlist.getState(), 'movies', 'm1')).toBe(false);
    expect(watchlist.getState().saveError).not.toBeNull();
  });
});
