import { describe, expect, expectTypeOf, it } from 'vitest';
import { createFakeBackend } from '../testing/fakeBackend';
import { createApiClient } from './apiClient';
import { createHttpClient } from './httpClient';
import type { LibraryPage, LoginResponse, MasterDetails, PlaybackInfo, ProfileDto } from './types';

function setup() {
  const backend = createFakeBackend();
  const api = createApiClient(createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch }));
  return { backend, api };
}

describe('createApiClient', () => {
  it('builds library, playback and catalog URLs with encoded segments and queries', async () => {
    const { backend, api } = setup();

    await api.library.list('movies', { categoryId: '4k/uhd', search: 'the matrix', offset: 100, limit: 50 }).catch(() => undefined);
    await api.library.get('series', 'a/b').catch(() => undefined);
    await api.playback.get('episode', '10 01', 'mkv').catch(() => undefined);
    await api.catalog.liveChannels(null).catch(() => undefined);
    await api.catalog.categories('live').catch(() => undefined);

    expect(backend.calls.map((call) => `${call.method} ${call.url.pathname}${call.url.search}`)).toEqual([
      'GET /api/library/movies?categoryId=4k%2Fuhd&search=the%20matrix&offset=100&limit=50',
      'GET /api/library/series/a%2Fb',
      'GET /api/playback/episode/10%2001?container=mkv',
      'GET /api/catalog/live/channels',
      'GET /api/catalog/live/categories',
    ]);
  });

  it('sends bodies for mutations', async () => {
    const { backend, api } = setup();
    backend.on('POST', '/api/auth/login', { body: {} });
    backend.on('PUT', '/api/profiles/p1', { body: {} });

    await api.auth.login({ serverUrl: 'host:8080', username: 'u', password: 'p' });
    await api.profiles.update('p1', { name: 'Kids', isKids: true });

    expect(backend.calls[0]!.body).toEqual({ serverUrl: 'host:8080', username: 'u', password: 'p' });
    expect(backend.calls[1]!.body).toEqual({ name: 'Kids', isKids: true });
  });

  it('exposes response types derived from the OpenAPI document', () => {
    const { api } = setup();

    expectTypeOf(api.auth.login).returns.resolves.toEqualTypeOf<LoginResponse>();
    expectTypeOf(api.profiles.list).returns.resolves.toEqualTypeOf<ProfileDto[]>();
    expectTypeOf(api.library.list).returns.resolves.toEqualTypeOf<LibraryPage>();
    expectTypeOf(api.library.get).returns.resolves.toEqualTypeOf<MasterDetails>();
    expectTypeOf(api.playback.get).returns.resolves.toEqualTypeOf<PlaybackInfo>();
    expectTypeOf(api.auth.logout).returns.resolves.toEqualTypeOf<undefined>();
  });
});
