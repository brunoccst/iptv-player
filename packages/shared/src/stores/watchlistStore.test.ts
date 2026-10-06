import { describe, expect, it } from 'vitest';
import { createTestAppContext } from '../testing/fakeBackend';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';
import { isOnWatchlist, watchlistCard } from './watchlistStore';

const heat = { id: 'm1', title: 'Heat', year: 1995, posterUrl: null };

async function setup(saved: object[] = []) {
  const backend = createFakeBackend();
  backend.on('GET', '/api/auth/me', { body: account });
  backend.on('GET', '/api/profiles', { body: [profile('p1'), profile('p2')] });
  backend.on('GET', '/api/profiles/p1/progress', { body: [] });
  backend.on('GET', '/api/profiles/p1/watchlist', { body: saved });
  const storage = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [profile('p1')], activeProfileId: null }),
  });
  const { stores } = createTestAppContext({
    config: { appName: 'T', appSlug: 't' },
    storage,
    backend,
  });
  await stores.session.getState().restore();
  stores.session.getState().selectProfile('p1');
  return { backend, watchlist: stores.watchlist, load: () => stores.watchlist.getState().load('p1') };
}

const variant = (quality: string | null, source: string | null) => ({
  streamId: `${quality}-${source}`,
  label: quality ?? '',
  quality,
  source,
  rawTitle: '',
  audioLanguages: [],
  audioTag: null,
  subtitleLanguages: [],
  isHdr: false,
  categoryId: null,
  containerExtension: null,
});
const details = (id: string, bestQuality: string | null, variants: ReturnType<typeof variant>[]) => ({
  id,
  title: id,
  year: null,
  posterUrl: null,
  rating: 7.5,
  bestQuality,
  variants,
});
const entry = (section: string, masterId: string) => ({ section, masterId, title: masterId, year: null, posterUrl: null, addedAt: 'x' });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('watchlist store', () => {
  it('loads for the active profile and toggles titles on and off', async () => {
    const { backend, watchlist, load } = await setup();
    await load();
    backend.on('PUT', '/api/profiles/p1/watchlist/movies/m1', ({ body }) => ({
      body: { section: 'movies', masterId: 'm1', ...(body as object), addedAt: 'x' },
    }));
    backend.on('DELETE', '/api/profiles/p1/watchlist/movies/m1', { status: 204 });

    await watchlist.getState().toggle('movies', heat);
    expect(isOnWatchlist(watchlist.getState(), 'movies', 'm1')).toBe(true);
    expect(backend.calls.find((call) => call.method === 'PUT')?.body).toEqual({ title: 'Heat', year: 1995, posterUrl: null });

    await watchlist.getState().toggle('movies', heat);
    expect(isOnWatchlist(watchlist.getState(), 'movies', 'm1')).toBe(false);
    expect(backend.calls.at(-1)?.method).toBe('DELETE');
  });

  it('undoes the change when saving fails', async () => {
    const { backend, watchlist, load } = await setup();
    await load();
    backend.on('PUT', '/api/profiles/p1/watchlist/movies/m1', { status: 400, body: { detail: 'full' } });
    await watchlist.getState().toggle('movies', heat);
    expect(isOnWatchlist(watchlist.getState(), 'movies', 'm1')).toBe(false);
    expect(watchlist.getState().saveError).not.toBeNull();
  });

  it('gives saved titles the quality badge and versions of their library card', async () => {
    const { backend, watchlist, load } = await setup([entry('movies', 'm4k'), entry('movies', 'mts'), entry('series', 'gone')]);
    backend.on('GET', '/api/library/movies/m4k', { body: details('m4k', '4K', [variant('4K', null), variant('1080p', null)]) });
    backend.on('GET', '/api/library/movies/mts', { body: details('mts', '1080p', [variant('1080p', 'TS')]) });
    backend.on('GET', '/api/library/series/gone', { status: 404 });

    await load();
    await settle();

    const cards = (watchlist.getState().items.data ?? []).map(watchlistCard);
    expect(
      cards.map(({ id, bestQuality, lowSource, variantCount, rating }) => ({ id, bestQuality, lowSource, variantCount, rating })),
    ).toEqual([
      { id: 'm4k', bestQuality: '4K', lowSource: null, variantCount: 2, rating: 7.5 },
      { id: 'mts', bestQuality: '1080p', lowSource: 'TS', variantCount: 1, rating: 7.5 },
      { id: 'gone', bestQuality: null, lowSource: null, variantCount: 1, rating: null },
    ]);
  });

  it('reads the quality of a title added to the list', async () => {
    const { backend, watchlist, load } = await setup();
    await load();
    backend.on('PUT', '/api/profiles/p1/watchlist/movies/m1', ({ body }) => ({
      body: { section: 'movies', masterId: 'm1', ...(body as object), addedAt: 'x' },
    }));
    backend.on('GET', '/api/library/movies/m1', { body: details('m1', '4K', [variant('4K', null)]) });

    await watchlist.getState().toggle('movies', heat);
    await settle();

    expect(watchlistCard(watchlist.getState().items.data![0]!).bestQuality).toBe('4K');
  });
});
