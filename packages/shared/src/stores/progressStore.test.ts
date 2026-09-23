import { describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { findProgress } from './progressStore';
import { createMemoryStorage } from './storage';

const config = { appName: 'T', appSlug: 't', apiBaseUrl: 'http://api.test' };
const entry = (itemId: string, updatedAt: string) => ({
  kind: 'movie', itemId, masterId: null, seriesId: null, seasonNumber: null, episodeNumber: null, title: itemId,
  posterUrl: null, containerExtension: null, positionSeconds: 100, durationSeconds: 5000, updatedAt,
});

describe('progress store', () => {
  it('loads when a profile is selected and saves optimistically', async () => {
    const backend = createFakeBackend();
    backend.on('POST', '/api/auth/login', { body: { token: 't', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile('p1'), profile('p2')] } });
    backend.on('GET', '/api/profiles/p1/progress', { body: [entry('55', '2026-01-01T00:00:00Z')] });
    backend.on('PUT', '/api/profiles/p1/progress/movie/77', ({ body }) => ({ body: { ...entry('77', 'x'), ...(body as object) } }));
    const { stores } = createAppContext({ config, storage: createMemoryStorage(), fetch: backend.fetch });
    await stores.session.getState().login({ serverUrl: 's', username: 'u', password: 'p' });

    stores.session.getState().selectProfile('p1');
    await stores.progress.getState().load('p1');
    expect(stores.progress.getState().items.data?.map((p) => p.itemId)).toEqual(['55']);

    const saving = stores.progress.getState().save('movie', '77', { title: 'Heat', positionSeconds: 300, durationSeconds: 6000 });
    expect(stores.progress.getState().items.data?.map((p) => p.itemId)).toEqual(['77', '55']);
    await saving;
    expect(findProgress(stores.progress.getState(), 'movie', '77')?.positionSeconds).toBe(300);
    expect(backend.calls.at(-1)!.body).toEqual({ title: 'Heat', positionSeconds: 300, durationSeconds: 6000 });

    stores.session.getState().selectProfile(null);
    expect(stores.progress.getState().profileId).toBeNull();
  });

  it('keeps optimistic data and exposes saveError when the server fails', async () => {
    const backend = createFakeBackend();
    backend.on('GET', '/api/profiles/p1/progress', { body: [] });
    backend.on('PUT', '/api/profiles/p1/progress/movie/1', { networkError: true });
    const { stores } = createAppContext({ config, storage: createMemoryStorage(), fetch: backend.fetch });
    await stores.progress.getState().load('p1');

    await stores.progress.getState().save('movie', '1', { title: 'A', positionSeconds: 50, durationSeconds: 100 });

    expect(stores.progress.getState().saveError?.code).toBe('network_error');
    expect(stores.progress.getState().items.data).toHaveLength(1);
  });
});
