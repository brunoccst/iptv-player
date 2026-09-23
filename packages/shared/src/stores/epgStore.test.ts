import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/apiClient';
import { createHttpClient } from '../api/httpClient';
import { createFakeBackend } from '../testing/fakeBackend';
import { createEpgStore, epgGridKey, type EpgGridRequest } from './epgStore';

const request: EpgGridRequest = { categoryId: '1', from: Date.parse('2026-09-23T12:00:00Z'), hours: 3 };
const grid = (status: string) => ({ status, updatedAt: null, from: '', to: '', totalChannels: 0, channels: [] });

function setup() {
  const backend = createFakeBackend();
  const api = createApiClient(createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch }));
  return { backend, epg: createEpgStore({ api, pollMs: 1000 }) };
}

describe('epg store', () => {
  afterEach(() => vi.useRealTimers());

  it('sends the window and page as query parameters', async () => {
    const { backend, epg } = setup();
    let query: URLSearchParams | undefined;
    backend.on('GET', '/api/epg', ({ url }) => {
      query = url.searchParams;
      return { body: grid('ready') };
    });

    await epg.getState().loadGrid({ ...request, offset: 50 });

    expect(Object.fromEntries(query!)).toEqual({
      categoryId: '1',
      from: '2026-09-23T12:00:00.000Z',
      hours: '3',
      offset: '50',
      limit: '50',
    });
    expect(epg.getState().grids[epgGridKey({ ...request, offset: 50 })]?.data?.status).toBe('ready');
  });

  it('polls while the first download is running, then stops', async () => {
    vi.useFakeTimers();
    const { backend, epg } = setup();
    const statuses = ['refreshing', 'refreshing', 'ready'];
    let calls = 0;
    backend.on('GET', '/api/epg', () => ({ body: grid(statuses[Math.min(calls++, 2)]!) }));

    const stop = epg.getState().watchGrid(request);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(3);
    expect(epg.getState().grids[epgGridKey(request)]?.data?.status).toBe('ready');
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(3);
    stop();
  });

  it('stop() cancels polling', async () => {
    vi.useFakeTimers();
    const { backend, epg } = setup();
    let calls = 0;
    backend.on('GET', '/api/epg', () => {
      calls++;
      return { body: grid('refreshing') };
    });

    const stop = epg.getState().watchGrid(request);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(1);
  });

  it('refresh() queues a download and drops cached pages', async () => {
    const { backend, epg } = setup();
    backend.on('GET', '/api/epg', { body: grid('ready') });
    backend.on('POST', '/api/epg/refresh', { status: 202 });
    await epg.getState().loadGrid(request);

    expect(await epg.getState().refresh()).toBe(true);
    expect(epg.getState().grids).toEqual({});
  });
});
