import { beforeAll, describe, expect, it } from 'vitest';
import type { ApiClient, LibraryListQuery } from '../api/apiClient';
import type { LibraryStatusProgress } from '../api/types';
import { createMemoryStorage } from '../stores/storage';
import { createFakePanel } from '../testing/fakePanel';
import { appLog } from '../utils/logger';
import { createNodeSqlDatabase } from '../testing/nodeSqlDatabase';
import { withUserDatabase } from '../stores/databaseStorage';
import { createDirectApiClient } from './directApiClient';
import type { SqlDatabase } from './sqlLibrary';

const login = { serverUrl: 'panel.test:8080', username: 'demo', password: 'demo' };

/** Each test runs twice: the library in memory (a browser) and in SQLite (TV, phone and desktop, D-121). */
let databaseMode = false;
/** Moves the clients' clock forward (saved copies growing old). */
let clockShiftMs = 0;
const newStorages = () => ({
  secure: createMemoryStorage(),
  data: createMemoryStorage(),
  db: databaseMode ? createNodeSqlDatabase() : undefined,
});

function setup(
  panel = createFakePanel(),
  storages: {
    secure: ReturnType<typeof createMemoryStorage>;
    data: ReturnType<typeof createMemoryStorage>;
    db?: SqlDatabase;
  } = newStorages(),
) {
  let ids = 0;
  // In the database mode, profiles, progress and My List are in the database too (D-126).
  const kept = withUserDatabase({ secure: storages.secure, data: storages.data }, storages.db);
  const api = createDirectApiClient({
    appName: 'Test',
    secureStorage: kept.secure,
    dataStorage: kept.data,
    fetch: panel.fetch,
    userAgent: 'VLC/3',
    now: () => new Date(panel.nowSeconds * 1000 + 5 * 60_000 + clockShiftMs),
    randomId: () => `id-${++ids}`,
    snapshotSaveMs: 0,
    libraryDb: storages.db,
  });
  return { api, panel, storages };
}

/** Waits for the background library build that login starts. */
async function libraryReady(api: ApiClient) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const statuses = await api.library.status();
    if (statuses.every((status) => status.jobStatus === 'done' || status.jobStatus === 'failed')) return statuses;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('library did not finish');
}

describe.each([
  ['in memory', false],
  ['in the database', true],
])('createDirectApiClient (library %s)', (_mode, useDatabase) => {
  beforeAll(() => {
    databaseMode = useDatabase;
  });

  it('signs in against the provider, creates a default profile and keeps the password out of the result', async () => {
    const { api } = setup();
    const response = await api.auth.login(login);

    expect(response.account).toMatchObject({
      providerType: 'xtream',
      serverUrl: 'http://panel.test:8080/',
      username: 'demo',
      maxConnections: 1,
    });
    expect(response.account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5/);
    expect(response.profiles).toEqual([{ id: 'id-1', name: 'demo', avatarKey: null, isKids: false }]);
    expect(JSON.stringify(response)).not.toContain('"password"');
    await expect(setup().api.auth.login({ ...login, password: 'wrong' })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_provider_credentials',
    });
  });

  it('restores the session from storage and answers 401 when signed out', async () => {
    const first = setup();
    await expect(first.api.auth.me()).rejects.toMatchObject({ status: 401 });
    const { account } = await first.api.auth.login(login);

    const restarted = setup(first.panel, first.storages);
    expect(await restarted.api.auth.me()).toEqual(account);
    await restarted.api.auth.logout();
    await expect(restarted.api.auth.me()).rejects.toMatchObject({ status: 401 });
  });

  it('keeps My List per profile on the device (D-055)', async () => {
    const { api } = setup();
    const { profiles } = await api.auth.login(login);
    const profileId = profiles[0]!.id;
    await api.watchlist.add(profileId, 'movies', 'm1', { title: 'Heat', year: 1995, posterUrl: null });
    await api.watchlist.add(profileId, 'series', 's1', { title: 'Dark', year: null, posterUrl: null });
    await api.watchlist.add(profileId, 'movies', 'm1', { title: 'Heat (1995)', year: 1995, posterUrl: null });
    expect((await api.watchlist.list(profileId)).map((item) => [item.masterId, item.title])).toEqual([
      ['m1', 'Heat (1995)'],
      ['s1', 'Dark'],
    ]);
    await api.watchlist.remove(profileId, 'movies', 'm1');
    expect((await api.watchlist.list(profileId)).map((item) => item.masterId)).toEqual(['s1']);
  });

  it('checks the account with the provider on restore (D-050)', async () => {
    const first = setup();
    await first.api.auth.login(login);
    const renewed = first.panel.nowSeconds + 90 * 24 * 3600;
    first.panel.setAccount('Active', renewed);

    const restarted = setup(first.panel, first.storages);
    expect((await restarted.api.auth.me()).expiresAt).toBe(new Date(renewed * 1000).toISOString());

    first.panel.setAccount('Expired');
    await expect(setup(first.panel, first.storages).api.auth.me()).rejects.toMatchObject({ status: 401 });

    first.panel.setAccount('Active');
    first.panel.offline();
    const offline = await setup(first.panel, first.storages)
      .api.auth.me()
      .then(
        () => null,
        (error: { status: number }) => error.status,
      );
    expect(offline).not.toBeNull();
    expect(offline).not.toBe(401);
  });

  it('builds the deduplicated library on the device and serves it offline after a restart', async () => {
    const { api, panel, storages } = setup();
    await api.auth.login(login);
    const statuses = await libraryReady(api);
    expect(statuses.map(({ mediaKind, jobStatus, masterCount, itemCount }) => [mediaKind, jobStatus, masterCount, itemCount])).toEqual([
      ['movie', 'done', 2, 3],
      ['series', 'done', 1, 1],
    ]);

    const page = await api.library.list('movies');
    expect(page.total).toBe(2);
    expect(page.items.map((card) => [card.title, card.year, card.variantCount, card.bestQuality])).toEqual([
      ['Another Film', 2019, 1, null],
      ['Big Test Movie', 2020, 2, '4K'],
    ]);
    expect(page.sorts).toEqual(['added', 'title', 'released']);
    const titles = async (query: LibraryListQuery) => (await api.library.list('movies', query)).items.map((card) => card.title);
    expect(await titles({ order: 'asc' })).toEqual(['Big Test Movie', 'Another Film']);
    expect(await titles({ sort: 'title', order: 'desc' })).toEqual(['Big Test Movie', 'Another Film']);
    expect(await titles({ sort: 'released' })).toEqual(['Big Test Movie', 'Another Film']);
    expect((await api.library.list('movies', { search: 'big' })).total).toBe(1);
    expect((await api.library.list('movies', { categoryIds: ['11', 'x'] })).items.map((card) => card.title)).toEqual(['Big Test Movie']);
    expect((await api.library.list('movies', { categoryIds: ['x'] })).total).toBe(0);
    expect((await api.library.list('movies', { categoryId: '11' })).items.map((card) => card.title)).toEqual(['Big Test Movie']);
    // Language filter (D-063): audio from "EN - …", subtitles from "SUB ITA"; unknown codes mean "all".
    expect(await titles({ language: 'ENG' })).toEqual(['Big Test Movie']);
    expect(await titles({ language: 'ita' })).toEqual(['Another Film']);
    expect(await titles({ language: 'GER' })).toEqual([]);
    expect(await titles({ language: 'GER,ita' })).toEqual(['Another Film']);
    expect(await titles({ language: 'ENG, ITA' })).toHaveLength(2);
    expect(await titles({ language: null })).toHaveLength(2);
    expect(await titles({ language: 'not-a-code' })).toHaveLength(2);
    // Hidden categories (D-110): a title goes only when every version is in one; search still finds it.
    expect(await titles({ hiddenCategoryIds: ['10'] })).toEqual(['Big Test Movie']);
    expect(await titles({ hiddenCategoryIds: ['10', '11'] })).toEqual([]);
    expect((await api.library.list('movies', { search: 'another', hiddenCategoryIds: ['10'] })).total).toBe(1);
    // Category hint (D-086): a version without a language in its name passes in a hinted category.
    expect(await titles({ language: 'GER', languageCategoryIds: ['10'] })).toEqual(['Big Test Movie']);
    expect(await titles({ language: 'GER', languageCategoryIds: ['11'] })).toEqual([]);
    expect(await titles({ language: 'ita', languageCategoryIds: ['10'] })).toEqual(['Another Film', 'Big Test Movie']);
    expect((await api.library.list('series')).items[0]).toMatchObject({ title: 'Test Series', year: 2021 });

    const details = await api.library.get('movies', page.items[1]!.id);
    expect(details.variants.map((variant) => [variant.streamId, variant.label])).toEqual([
      ['101', '4K · ENG'],
      ['102', '1080p'],
    ]);
    await expect(api.library.get('movies', 'missing')).rejects.toMatchObject({ status: 404 });

    panel.offline();
    const restarted = setup(panel, storages).api;
    expect((await restarted.library.list('movies')).total).toBe(2);
  });

  it('reports download and grouping progress while the library builds; series do not wait for movies', async () => {
    const panel = createFakePanel();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slowMovies = (async (url: string, init?: RequestInit) => {
      if (url.includes('action=get_vod_streams')) await gate;
      return panel.fetch(url, init);
    }) as typeof globalThis.fetch;
    const { api } = setup({ ...panel, fetch: slowMovies });
    await api.auth.login(login);
    const stageOf = async (kind: string) => {
      const status = (await api.library.status()).find((item) => item.mediaKind === kind) as {
        stage?: string | null;
        jobStatus: string | null;
      };
      return status.stage ?? status.jobStatus;
    };
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await stageOf('movie')).toBe('downloading');
    // Series do not wait for the movie list: they are grouped and ready as soon as their own list is in (D-093).
    for (let attempt = 0; attempt < 50 && (await stageOf('series')) !== 'done'; attempt++) await new Promise((r) => setTimeout(r, 5));
    expect(await stageOf('series')).toBe('done');
    expect((await api.library.list('series')).total).toBeGreaterThan(0);
    expect(await stageOf('movie')).toBe('downloading');

    release();
    await libraryReady(api);
    expect(await stageOf('movie')).toBe('done');
    expect((await api.library.status()).find((item) => item.mediaKind === 'movie')).toMatchObject({ itemCount: 3, parsedCount: 3 });
  });

  it('Refresh library reuses the saved titles that did not change, after a restart too (D-109)', async () => {
    const first = setup();
    await first.api.auth.login(login);
    await libraryReady(first.api);
    const before = await first.api.library.list('movies');

    const restarted = setup(first.panel, first.storages).api;
    const logged = appLog.entries().length;
    await restarted.auth.me();
    await restarted.library.sync();
    await libraryReady(restarted);
    const messages = appLog
      .entries()
      .slice(logged)
      .map((entry) => entry.message);
    expect(
      messages.filter((message) => /^movie: grouped into 2 titles in \d+ ms, 3 names and 2 titles unchanged$/.test(message)),
    ).toHaveLength(1);
    expect(await restarted.library.list('movies')).toEqual(before);
  });

  it('sync answers once the update shows as processing (the first "Refresh library" seemed to do nothing, D-119)', async () => {
    const panel = createFakePanel();
    // The movie list answers only when the test says so: the update is still running when the status is read.
    let release: () => void = () => undefined;
    let hold = false;
    const fetch = panel.fetch;
    panel.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (hold && String(input).includes('get_vod_streams')) await new Promise<void>((resolve) => (release = resolve));
      return fetch(input, init);
    }) as typeof panel.fetch;
    const { api } = setup(panel);
    await api.auth.login(login);
    await libraryReady(api);
    // The login's update marks itself done a moment before it ends: let it end, so the refresh starts a new one.
    await new Promise((resolve) => setTimeout(resolve, 50));
    hold = true;
    await api.library.sync();
    // Movies are held, so they are still processing (series may already be done).
    expect((await api.library.status()).find((status) => status.mediaKind === 'movie')?.jobStatus).toBe('processing');
    hold = false;
    release();
    await libraryReady(api);
  });

  it('a refresh reports what changed: nothing, an added title, a removed one (D-119)', async () => {
    const { api, panel } = setup();
    await api.auth.login(login);
    await libraryReady(api);
    const movieChanges = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await api.library.sync();
      const statuses = (await libraryReady(api)) as LibraryStatusProgress[];
      return statuses.find((status) => status.mediaKind === 'movie')?.changes;
    };
    expect(await movieChanges()).toEqual({ added: 0, changed: 0, removed: 0 });
    panel.movies.push({ ...panel.movies[0]!, stream_id: 999, name: 'EN - A Brand New Film (2026)' });
    expect(await movieChanges()).toEqual({ added: 1, changed: 0, removed: 0 });
    panel.movies.pop();
    expect(await movieChanges()).toEqual({ added: 0, changed: 0, removed: 1 });
  });

  it('reuses the saved library after a restart when many screens ask at once', async () => {
    const first = setup();
    await first.api.auth.login(login);
    await libraryReady(first.api);
    const downloads = () => first.panel.calls.filter((url) => url.includes('action=get_vod_streams')).length;
    const before = downloads();

    const restarted = setup(first.panel, first.storages).api;
    const [, statuses, page] = await Promise.all([restarted.auth.me(), restarted.library.status(), restarted.library.list('movies')]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statuses.map((status) => status.jobStatus)).toEqual(['done', 'done']);
    expect(page.total).toBe(2);
    expect(downloads()).toBe(before);
  });

  // With the database there is no saved file to wait for: the next test.
  it.runIf(!useDatabase)('after a restart, Home answers from the snapshot while the saved library is still read (D-120)', async () => {
    const first = setup();
    await first.api.auth.login(login);
    await libraryReady(first.api);
    const hero = await first.api.library.list('movies', { limit: 30 });
    const row = await first.api.library.list('series', { limit: 10, categoryId: '20' });
    const details = await first.api.library.get('movies', hero.items[0]!.id);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // A library read that never ends: only the snapshot can answer.
    const slowStorage = (data: typeof first.storages.data) => ({
      ...data,
      getItem: (key: string) => (key.startsWith('direct.library.') ? new Promise<string | null>(() => undefined) : data.getItem(key)),
    });
    const pending = <T>(promise: Promise<T>) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('pending'), 30))]);
    const restart = () => setup(first.panel, { secure: first.storages.secure, data: slowStorage(first.storages.data) }).api;

    const restarted = restart();
    // The same query with its fields in another order is the same list.
    expect(await restarted.library.list('series', { categoryId: '20', limit: 10 })).toEqual(row);
    expect(await restarted.library.list('movies', { limit: 30 })).toEqual(hero);
    expect(await restarted.library.get('movies', hero.items[0]!.id)).toEqual(details);
    // Anything else waits for the library.
    expect(await pending(restarted.library.list('movies', { limit: 30, search: 'big' }))).toBe('pending');
    expect(await pending(restarted.library.list('movies', { limit: 30, offset: 30 }))).toBe('pending');

    // A new library drops the answers from the old one before it is saved.
    first.panel.movies.push({ ...first.panel.movies[0]!, stream_id: 999, name: 'EN - A Brand New Film (2026)' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await first.api.library.sync();
    await libraryReady(first.api);
    expect(await pending(restart().library.list('movies', { limit: 30 }))).toBe('pending');
    // Asked again from the new library, it is kept again.
    const updated = await first.api.library.list('movies', { limit: 30 });
    expect(updated.total).toBe(hero.total + 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await restart().library.list('movies', { limit: 30 })).toEqual(updated);
  });

  it.runIf(useDatabase)('moves a saved library file into the database once; then no start reads a file (D-121)', async () => {
    // The app before D-121: the library in files.
    databaseMode = false;
    const first = setup();
    databaseMode = true;
    await first.api.auth.login(login);
    await libraryReady(first.api);
    const movies = await first.api.library.list('movies');
    const series = await first.api.library.list('series', { categoryId: '20' });
    const details = await first.api.library.get('movies', movies.items[1]!.id);
    const fileKeys = () => [...first.storages.data.data.keys()].filter((key) => key.startsWith('direct.library.'));
    expect(fileKeys()).toHaveLength(2);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const snapshots = () => [...first.storages.data.data.keys()].filter((key) => key.startsWith('direct.snapshot.'));
    expect(snapshots()).toHaveLength(1);

    // The update: the same storage, now with a database. The files are moved in, then removed.
    const db = createNodeSqlDatabase();
    const moved = setup(first.panel, { ...first.storages, db }).api;
    expect(await moved.library.list('movies')).toEqual(movies);
    expect(await moved.library.list('series', { categoryId: '20' })).toEqual(series);
    expect(await moved.library.get('movies', movies.items[1]!.id)).toEqual(details);
    expect(fileKeys()).toEqual([]);
    // Home's snapshot (D-120) is not needed with a database (D-122).
    expect(snapshots()).toEqual([]);
    expect((await moved.library.status()).map((status) => [status.jobStatus, status.masterCount])).toEqual([
      ['done', 2],
      ['done', 1],
    ]);

    // Next start: nothing is read from files (a file read would never end here), everything answers.
    const noFiles = {
      ...first.storages.data,
      getItem: (key: string) =>
        key.startsWith('direct.library.') ? new Promise<string | null>(() => undefined) : first.storages.data.getItem(key),
    };
    const restarted = setup(first.panel, { secure: first.storages.secure, data: noFiles as typeof first.storages.data, db }).api;
    expect(await restarted.library.list('movies', { search: 'big' })).toMatchObject({ total: 1 });
    expect(await restarted.library.list('movies', { offset: 1, limit: 1 })).toMatchObject({ total: 2, items: [movies.items[1]] });
    expect(await restarted.library.get('movies', movies.items[1]!.id)).toEqual(details);
  });

  it('keeps profiles on the device', async () => {
    const { api } = setup();
    await api.auth.login(login);
    const kids = await api.profiles.create({ name: ' Kids ', isKids: true });
    expect(kids).toMatchObject({ name: 'Kids', avatarKey: null, isKids: true });
    await expect(api.profiles.create({ name: 'KIDS', isKids: false })).rejects.toThrow("A profile named 'KIDS' already exists.");
    expect(await api.profiles.update(kids.id, { name: 'Children', isKids: true })).toMatchObject({ name: 'Children' });
    await expect(api.profiles.update('nope', { name: 'X', isKids: false })).rejects.toMatchObject({ status: 404 });
    for (const name of ['A', 'B', 'C']) await api.profiles.create({ name, isKids: false });
    await expect(api.profiles.create({ name: 'Sixth', isKids: false })).rejects.toThrow('at most 5 profiles');

    await api.profiles.remove(kids.id);
    expect((await api.profiles.list()).map((profile) => profile.name)).toEqual(['demo', 'A', 'B', 'C']);
  });

  it('refuses to delete the last profile', async () => {
    const { api } = setup();
    const { profiles } = await api.auth.login(login);
    await expect(api.profiles.remove(profiles[0]!.id)).rejects.toThrow('The last profile cannot be deleted.');
  });

  it('stores watch progress per profile, newest first', async () => {
    const { api } = setup();
    const { profiles } = await api.auth.login(login);
    const profileId = profiles[0]!.id;
    await api.progress.save(profileId, 'movie', '101', { title: 'Big Test Movie', positionSeconds: 40, durationSeconds: 60 });
    await api.progress.save(profileId, 'episode', 'e1', { title: 'Pilot', positionSeconds: -5, durationSeconds: 30, seriesId: '201' });
    const saved = await api.progress.save(profileId, 'movie', '101', { title: 'Big Test Movie', positionSeconds: 50, durationSeconds: 60 });

    expect(saved).toMatchObject({ kind: 'movie', itemId: '101', positionSeconds: 50, masterId: null });
    const list = await api.progress.list(profileId);
    expect(list.map((item) => [item.itemId, item.positionSeconds])).toEqual([
      ['101', 50],
      ['e1', 0],
    ]);
    expect(await api.progress.list(profileId, 1)).toHaveLength(1);
    await api.progress.remove(profileId, 'movie', '101');
    expect((await api.progress.list(profileId)).map((item) => item.itemId)).toEqual(['e1']);
    await expect(api.progress.list('other-profile')).rejects.toMatchObject({ status: 404 });
  });

  it('builds guide pages from the short EPG, clipped to the window', async () => {
    const { api, panel } = setup();
    await api.auth.login(login);
    const grid = await api.epg.grid({ hours: 1, limit: 2 });

    expect(grid).toMatchObject({ status: 'ready', totalChannels: 3, from: '2026-01-01T20:00:00.000Z', to: '2026-01-01T21:00:00.000Z' });
    expect(grid.channels.map((row) => [row.channel.name, row.programmes.map((programme) => programme.title)])).toEqual([
      ['News', ['Evening News', 'Late News']],
      ['Broken guide', []],
    ]);
    const epgCalls = panel.calls.filter((url) => url.includes('get_short_epg')).length;
    await api.epg.grid({ hours: 1, limit: 2 });
    expect(panel.calls.filter((url) => url.includes('get_short_epg'))).toHaveLength(epgCalls);
    expect((await api.epg.grid({ offset: 2 })).channels.map((row) => row.channel.name)).toEqual(['Sport']);
  });

  it.runIf(useDatabase)(
    'keeps categories, movie info, episodes and the guide in the database: no download after a restart, old copies offline (D-125)',
    async () => {
      const first = setup();
      await first.api.auth.login(login);
      const read = async (api: ApiClient) => ({
        categories: (await api.catalog.categories('movies')).map((category) => category.id),
        movie: (await api.catalog.movie('101')).plot ?? null,
        seasons: (await api.catalog.seriesDetails('201')).seasons.length,
        guide: (await api.epg.grid({ hours: 1, limit: 1 })).channels[0]!.programmes.map((programme) => programme.title),
      });
      const before = await read(first.api);
      expect(before.guide).toEqual(['Evening News', 'Late News']);
      await new Promise((resolve) => setTimeout(resolve, 20)); // the copies are saved in the background

      const asked = (action: string) => first.panel.calls.filter((url) => url.includes(`action=${action}`)).length;
      const counts = () => ['get_vod_categories', 'get_vod_info', 'get_series_info', 'get_short_epg'].map(asked);
      const downloaded = counts();
      const restarted = setup(first.panel, first.storages);
      expect(await read(restarted.api)).toEqual(before);
      expect(counts()).toEqual(downloaded);

      // Two weeks later and offline: every copy is old, the provider cannot answer, the old copies still do.
      clockShiftMs = 14 * 24 * 3600_000;
      try {
        first.panel.offline();
        const offline = setup(first.panel, first.storages);
        const { categories, movie, seasons } = await read(offline.api).catch(() => ({ categories: null, movie: null, seasons: null }));
        expect({ categories, movie, seasons }).toEqual({ categories: before.categories, movie: before.movie, seasons: before.seasons });
      } finally {
        clockShiftMs = 0;
      }
    },
  );

  it('returns direct provider URLs for playback', async () => {
    const { api } = setup();
    await api.auth.login(login);
    expect(await api.playback.get('live', '1')).toEqual({
      url: 'http://panel.test:8080/live/demo/demo/1.m3u8',
      container: 'm3u8',
      isLive: true,
      alternateUrls: [],
      deliveryMode: 'direct',
    });
    await expect(api.catalog.movie('999')).rejects.toMatchObject({ status: 404 });
  });
});
