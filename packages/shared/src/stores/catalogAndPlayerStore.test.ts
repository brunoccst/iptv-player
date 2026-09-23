import { describe, expect, it } from 'vitest';
import { createApiClient } from '../api/apiClient';
import { createHttpClient } from '../api/httpClient';
import { createFakeBackend } from '../testing/fakeBackend';
import { ALL_CATEGORIES_KEY, createCatalogStore } from './catalogStore';
import { createPlayerStore } from './playerStore';

function api() {
  const backend = createFakeBackend();
  return { backend, api: createApiClient(createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch })) };
}

describe('catalog store', () => {
  it('loads categories per section and channels per category', async () => {
    const { backend, api: client } = api();
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => ({ body: [{ id: url.searchParams.get('categoryId') ?? 'all' }] }));
    const catalog = createCatalogStore({ api: client });

    await catalog.getState().loadCategories('live');
    await catalog.getState().loadLiveChannels(null);
    await catalog.getState().loadLiveChannels('1');

    expect(catalog.getState().categories.live?.data?.[0]?.name).toBe('News');
    expect(catalog.getState().liveChannels[ALL_CATEGORIES_KEY]?.data).toEqual([{ id: 'all' }]);
    expect(catalog.getState().liveChannels['1']?.data).toEqual([{ id: '1' }]);

    catalog.getState().reset();
    expect(catalog.getState().categories).toEqual({});
  });
});

describe('player store', () => {
  const playback = (url: string) => ({ url, container: 'm3u8', isLive: true, deliveryMode: 'relay' });

  it('resolves playback info and exposes errors', async () => {
    const { backend, api: client } = api();
    backend.on('GET', '/api/playback/live/42', { body: playback('http://api.test/api/relay/t/42.m3u8') });
    backend.on('GET', '/api/playback/movie/7', { status: 502, body: { code: 'provider_unavailable' } });
    const player = createPlayerStore({ api: client });

    await player.getState().open({ kind: 'live', id: '42' });
    expect(player.getState()).toMatchObject({ status: 'ready', playback: { url: 'http://api.test/api/relay/t/42.m3u8' } });

    await player.getState().open({ kind: 'movie', id: '7' });
    expect(player.getState()).toMatchObject({ status: 'error', playback: null, error: { code: 'provider_unavailable' } });

    player.getState().close();
    expect(player.getState()).toMatchObject({ status: 'idle', request: null });
  });

  it('ignores a slow earlier response after a newer open', async () => {
    const { backend, api: client } = api();
    let releaseSlow!: () => void;
    backend.on('GET', '/api/playback/live/slow', () => new Promise((resolve) => (releaseSlow = () => resolve({ body: playback('slow') }))));
    backend.on('GET', '/api/playback/live/fast', { body: playback('fast') });
    const player = createPlayerStore({ api: client });

    const slow = player.getState().open({ kind: 'live', id: 'slow' });
    await player.getState().open({ kind: 'live', id: 'fast' });
    releaseSlow();

    await expect(slow).resolves.toBeNull();
    expect(player.getState().playback?.url).toBe('fast');
    expect(player.getState().request?.id).toBe('fast');
  });
});
