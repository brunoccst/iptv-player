import { describe, expect, it } from 'vitest';
import type { ApiClient, LibraryListQuery } from '../api/apiClient';
import { createConnectionStore } from '../stores/connectionStore';
import { createMemoryStorage } from '../stores/storage';
import { createFakePanel } from '../testing/fakePanel';
import { createDirectApiClient } from './directApiClient';
import { createHybridApiClient } from './hybridApiClient';

const login = { serverUrl: 'panel.test:8080', username: 'demo', password: 'demo' };

function setup(panel = createFakePanel(), storages = { secure: createMemoryStorage(), data: createMemoryStorage() }) {
  let ids = 0;
  const api = createDirectApiClient({
    appName: 'Test',
    secureStorage: storages.secure,
    dataStorage: storages.data,
    fetch: panel.fetch,
    userAgent: 'VLC/3',
    now: () => new Date(panel.nowSeconds * 1000 + 5 * 60_000),
    randomId: () => `id-${++ids}`,
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

describe('createDirectApiClient', () => {
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
    expect((await api.library.list('movies', { categoryId: '11' })).items.map((card) => card.title)).toEqual(['Big Test Movie']);
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

  it('reports download and grouping progress while the library builds', async () => {
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

    release();
    await libraryReady(api);
    expect(await stageOf('movie')).toBe('done');
    expect((await api.library.status()).find((item) => item.mediaKind === 'movie')).toMatchObject({ itemCount: 3, parsedCount: 3 });
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

  it('keeps profiles on the device with the backend rules', async () => {
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

describe('createHybridApiClient', () => {
  it('routes each call to the client chosen by the saved connection', async () => {
    const connection = createConnectionStore({ storage: createMemoryStorage(), defaultServerUrl: 'http://tv-server:5080' });
    const direct = setup().api;
    const serverCalls: string[] = [];
    const server = {
      ...direct,
      health: async () => {
        serverCalls.push(connection.getState().serverUrl);
        return { status: 'ok', app: 'server' };
      },
    } as ApiClient;
    const api = createHybridApiClient({ server, direct, connection });

    expect(await api.health()).toEqual({ status: 'ok', app: 'Test' });
    await connection.getState().setConnection('server', 'http://home-pc:5080/');
    expect(await api.health()).toEqual({ status: 'ok', app: 'server' });
    expect(serverCalls).toEqual(['http://home-pc:5080']);
  });

  it('loads the saved choice before the first call', async () => {
    const storage = createMemoryStorage({ connection: JSON.stringify({ mode: 'server', serverUrl: 'http://saved:5080' }) });
    const connection = createConnectionStore({ storage });
    await connection.getState().load();
    expect(connection.getState()).toMatchObject({ mode: 'server', serverUrl: 'http://saved:5080', loaded: true });
    const broken = createConnectionStore({ storage: createMemoryStorage({ connection: '{' }) });
    await broken.getState().load();
    expect(broken.getState().mode).toBe('direct');
  });
});
