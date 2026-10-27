import { describe, expect, it } from 'vitest';
import { createTestAppContext } from '../testing/fakeBackend';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';
import { isOnWatchlist, qualityUpgrades, upgradeLine, watchlistCard } from './watchlistStore';

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
  return { backend, stores, watchlist: stores.watchlist, load: () => stores.watchlist.getState().load('p1') };
}

const variant = (quality: string | null, source: string | null, audioLanguages: string[] = []) => ({
  streamId: `${quality}-${source}`,
  label: quality ?? '',
  quality,
  source,
  rawTitle: '',
  audioLanguages,
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

  describe('better copies (D-176)', () => {
    const lowSourceCalls = (backend: Awaited<ReturnType<typeof setup>>['backend']) =>
      backend.calls
        .filter((call) => call.method === 'POST' && call.url.pathname.endsWith('/watchlist/low-sources'))
        .map((call) => call.body);

    it('remembers a cinema copy and announces the movie once a better copy arrives', async () => {
      const { backend, watchlist, load } = await setup([entry('movies', 'm1')]);
      backend.on('POST', '/api/profiles/p1/watchlist/low-sources', { status: 204 });
      backend.on('GET', '/api/library/movies/m1', { body: details('m1', '1080p', [variant('1080p', 'TS')]) });
      await load();
      await settle();

      expect(lowSourceCalls(backend)).toEqual([[{ section: 'movies', masterId: 'm1', lowSource: 'TS' }]]);
      expect(qualityUpgrades(watchlist.getState().items.data)).toEqual([]);

      backend.on('GET', '/api/library/movies/m1', {
        body: details('m1', '1080p', [variant('1080p', 'TS'), variant('1080p', 'WEB')]),
      });
      await watchlist.getState().recheckQuality();

      const upgrades = qualityUpgrades(watchlist.getState().items.data);
      expect(upgrades.map((item) => item.masterId)).toEqual(['m1']);
      expect(upgradeLine(upgrades[0]!)).toBe('Now 1080p, was TS');

      await watchlist.getState().dismissUpgrades(upgrades);
      expect(qualityUpgrades(watchlist.getState().items.data)).toEqual([]);
      expect(lowSourceCalls(backend).at(-1)).toEqual([{ section: 'movies', masterId: 'm1', lowSource: null }]);
    });

    it('announces a saved cinema copy that is better when the app opens', async () => {
      const { backend, watchlist, load } = await setup([{ ...entry('movies', 'm1'), lowSourceSeen: 'CAM' }]);
      backend.on('GET', '/api/library/movies/m1', { body: details('m1', '720p', [variant('720p', null)]) });
      await load();
      await settle();

      expect(qualityUpgrades(watchlist.getState().items.data).map((item) => item.masterId)).toEqual(['m1']);
    });

    it('announces a series whose versions were all cinema copies once a better one arrives (issue #251)', async () => {
      const { backend, watchlist, load } = await setup([{ ...entry('series', 's1'), lowSourceSeen: 'TS' }]);
      backend.on('GET', '/api/library/series/s1', { body: details('s1', '1080p', [variant('1080p', 'WEB')]) });
      await load();
      await settle();

      expect(qualityUpgrades(watchlist.getState().items.data).map((item) => item.masterId)).toEqual(['s1']);
    });

    it("waits for a better copy in the profile's languages (D-233)", async () => {
      const { backend, stores, watchlist, load } = await setup([entry('movies', 'm1')]);
      await stores.profilePrefs.getState().update('p1', { languages: ['ENG', 'POR'] });
      backend.on('POST', '/api/profiles/p1/watchlist/low-sources', { status: 204 });
      // A French copy was already good: the English and Portuguese ones are what count.
      backend.on('GET', '/api/library/movies/m1', {
        body: details('m1', '1080p', [variant('720p', 'TS', ['ENG']), variant('720p', 'TS', ['POR']), variant('1080p', 'WEB', ['FRE'])]),
      });
      await load();
      await settle();
      expect(lowSourceCalls(backend)).toEqual([[{ section: 'movies', masterId: 'm1', lowSource: 'TS' }]]);
      expect(watchlistCard(watchlist.getState().items.data![0]!)).toMatchObject({ bestQuality: '720p', lowSource: 'TS' });

      backend.on('GET', '/api/library/movies/m1', {
        body: details('m1', '4K', [variant('720p', 'TS', ['ENG']), variant('720p', 'TS', ['POR']), variant('4K', 'WEB', ['FRE'])]),
      });
      await watchlist.getState().recheckQuality();
      expect(qualityUpgrades(watchlist.getState().items.data)).toEqual([]);

      backend.on('GET', '/api/library/movies/m1', {
        body: details('m1', '4K', [variant('1080p', 'WEB', ['ENG']), variant('720p', 'TS', ['POR']), variant('4K', 'WEB', ['FRE'])]),
      });
      await watchlist.getState().recheckQuality();
      const upgrades = qualityUpgrades(watchlist.getState().items.data);
      expect(upgrades.map((item) => item.masterId)).toEqual(['m1']);
      expect(upgradeLine(upgrades[0]!)).toBe('Now 1080p, was TS');
    });

    it('reads My List again when the profile chooses other languages (D-233)', async () => {
      const { backend, stores, watchlist, load } = await setup([{ ...entry('movies', 'm1'), lowSourceSeen: 'TS' }]);
      await stores.profilePrefs.getState().update('p1', { languages: ['ENG'] });
      backend.on('GET', '/api/library/movies/m1', {
        body: details('m1', '1080p', [variant('720p', 'TS', ['ENG']), variant('1080p', 'WEB', ['FRE'])]),
      });
      await load();
      await settle();
      expect(qualityUpgrades(watchlist.getState().items.data)).toEqual([]);

      await stores.profilePrefs.getState().update('p1', { languages: ['ENG', 'FRE'] });
      await settle();
      expect(qualityUpgrades(watchlist.getState().items.data).map((item) => item.masterId)).toEqual(['m1']);
    });

    it('never announces titles already good when added, or titles gone from the library', async () => {
      const { backend, watchlist, load } = await setup([entry('series', 's1'), { ...entry('movies', 'gone'), lowSourceSeen: 'TS' }]);
      backend.on('POST', '/api/profiles/p1/watchlist/low-sources', { status: 204 });
      backend.on('GET', '/api/library/series/s1', { body: details('s1', '1080p', [variant('1080p', 'WEB')]) });
      backend.on('GET', '/api/library/movies/good', { body: details('good', '4K', [variant('4K', 'BLURAY')]) });
      backend.on('GET', '/api/library/movies/gone', { status: 404 });
      await load();
      await settle();
      await watchlist.getState().recheckQuality();

      expect(qualityUpgrades(watchlist.getState().items.data)).toEqual([]);
      expect(lowSourceCalls(backend)).toEqual([]);
    });
  });
});
