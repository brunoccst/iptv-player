import type { ApiClient } from '../api/apiClient';
import { ApiError } from '../api/errors';
import { createAppContext, type AppContext, type AppContextOptions } from '../appContext';

/** Test-only fake of the app's data (`ApiClient`), described as routes. Not exported from the package. */
export interface FakeResponse {
  status?: number;
  body?: unknown;
  /** Throw instead of responding (simulates network failure). */
  networkError?: boolean;
}

export type FakeHandler = (request: { url: URL; init: RequestInit; body: unknown }) => FakeResponse | Promise<FakeResponse>;

export interface FakeBackend {
  fetch: typeof fetch;
  calls: { method: string; url: URL; headers: Record<string, string>; body: unknown }[];
  on(method: string, path: string, handler: FakeHandler | FakeResponse): void;
}

export function createFakeBackend(): FakeBackend {
  const routes = new Map<string, FakeHandler>();
  const calls: FakeBackend['calls'] = [];

  const fakeFetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, headers: { ...(init.headers as Record<string, string>) }, body });

    const handler = routes.get(`${method} ${url.pathname}`);
    const result = handler ? await handler({ url, init, body }) : { status: 404 };
    if (result.networkError) throw new TypeError('Network request failed');

    const status = result.status ?? 200;
    const hasBody = result.body !== undefined;
    return new Response(hasBody ? JSON.stringify(result.body) : null, {
      status,
      headers: hasBody ? { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } : {},
    });
  }) as typeof fetch;

  return {
    fetch: fakeFetch,
    calls,
    on(method, path, handler) {
      routes.set(`${method} ${path}`, typeof handler === 'function' ? handler : () => handler);
    },
  };
}

export const account = {
  id: 'acc-1',
  providerType: 'xtream',
  serverUrl: 'http://provider.test/',
  username: 'user',
  status: 'Active',
  expiresAt: null,
  maxConnections: 1,
};

export const profile = (id: string, name = id) => ({ id, name, avatarKey: null, isKids: false });

/** Where the fake answers; tests read `calls[n].url` to check what the app asked for. */
export const FAKE_API_BASE = 'http://api.test';

type Query = Record<string, string | number | boolean | null | undefined>;

/**
 * An `ApiClient` whose calls become requests to a `FakeBackend`, one route per method (`GET /api/library/movies`,
 * `PUT /api/profiles/{id}/progress/{kind}/{itemId}`…). Tests describe answers per route and check `calls`. A 401
 * answer to a signed-in call runs `onUnauthorized`, like a revoked login.
 */
export function createFakeApi(
  backend: Pick<FakeBackend, 'fetch'>,
  options: { getToken?: () => string | null; onUnauthorized?: () => void } = {},
): ApiClient {
  const request = async <T>(method: string, path: string, { query, body }: { query?: Query; body?: unknown } = {}): Promise<T> => {
    const token = options.getToken?.() ?? null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const search = Object.entries(query ?? {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    let response: Response;
    try {
      response = await backend.fetch(`${FAKE_API_BASE}${path}${search ? `?${search}` : ''}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new ApiError(0, 'network_error', `Network error: ${method} ${path} (${String(error)})`);
    }
    if (response.ok) {
      const text = response.status === 204 || response.status === 202 ? '' : await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    if (response.status === 401 && token) options.onUnauthorized?.();
    const problem = response.headers.get('content-type')?.includes('json')
      ? ((await response.json().catch(() => null)) as { code?: string; detail?: string; title?: string } | null)
      : null;
    const code = problem?.code ?? (response.status === 401 ? 'unauthorized' : response.status === 404 ? 'not_found' : 'http_error');
    throw new ApiError(response.status, code, problem?.detail ?? problem?.title ?? `${method} ${path} failed with HTTP ${response.status}`);
  };
  const get = <T>(path: string, query?: Query) => request<T>('GET', path, { query });
  const id = encodeURIComponent;
  const list = (ids?: string[] | null) => (ids ? ids.join(',') : undefined);

  return {
    auth: {
      login: (body) => request('POST', '/api/auth/login', { body }),
      logout: () => request('POST', '/api/auth/logout'),
      me: () => get('/api/auth/me'),
    },
    profiles: {
      list: () => get('/api/profiles'),
      create: (body) => request('POST', '/api/profiles', { body }),
      update: (profileId, body) => request('PUT', `/api/profiles/${id(profileId)}`, { body }),
      remove: (profileId) => request('DELETE', `/api/profiles/${id(profileId)}`),
    },
    progress: {
      list: (profileId, limit) => get(`/api/profiles/${id(profileId)}/progress`, { limit }),
      save: (profileId, kind, itemId, body) => request('PUT', `/api/profiles/${id(profileId)}/progress/${kind}/${id(itemId)}`, { body }),
      remove: (profileId, kind, itemId) => request('DELETE', `/api/profiles/${id(profileId)}/progress/${kind}/${id(itemId)}`),
    },
    watchlist: {
      list: (profileId) => get(`/api/profiles/${id(profileId)}/watchlist`),
      add: (profileId, section, masterId, body) =>
        request('PUT', `/api/profiles/${id(profileId)}/watchlist/${section}/${id(masterId)}`, { body }),
      remove: (profileId, section, masterId) => request('DELETE', `/api/profiles/${id(profileId)}/watchlist/${section}/${id(masterId)}`),
    },
    catalog: {
      categories: (section) => get(`/api/catalog/${section}/categories`),
      liveChannels: (categoryId) => get('/api/catalog/live/channels', { categoryId }),
      searchProgrammes: (search, options) => get('/api/catalog/live/programmes', { search, limit: options?.limit?.toString() }),
      movies: (categoryId) => get('/api/catalog/movies', { categoryId }),
      movie: (movieId) => get(`/api/catalog/movies/${id(movieId)}`),
      series: (categoryId) => get('/api/catalog/series', { categoryId }),
      seriesDetails: (seriesId) => get(`/api/catalog/series/${id(seriesId)}`),
    },
    library: {
      sync: () => request('POST', '/api/library/sync'),
      status: () => get('/api/library/status'),
      list: (section, query = {}) =>
        get(`/api/library/${section}`, {
          ...query,
          categoryIds: list(query.categoryIds),
          languageCategoryIds: list(query.languageCategoryIds),
        } as Query),
      get: (section, masterId) => get(`/api/library/${section}/${id(masterId)}`),
    },
    epg: {
      grid: (query = {}) => get('/api/epg', { ...query, categoryIds: list(query.categoryIds) } as Query),
      refresh: () => request('POST', '/api/epg/refresh'),
    },
    playback: {
      get: (kind, playId, container) => get(`/api/playback/${kind}/${id(playId)}`, { container }),
    },
  };
}

/**
 * `createAppContext` for tests: every call goes to `backend` through `createFakeApi` (signed-in calls carry the
 * session's token; a 401 signs out). Without `backend` the context keeps its direct client (tests that use no data).
 * `direct.dataStorage` defaults to `storage`.
 */
export function createTestAppContext({
  backend,
  direct,
  ...options
}: Omit<AppContextOptions, 'direct' | 'api'> & { backend?: Pick<FakeBackend, 'fetch'>; direct?: AppContextOptions['direct'] }): AppContext {
  const context = createAppContext({ ...options, direct: direct ?? { dataStorage: options.storage } });
  if (backend) {
    const session = () => context.stores.session.getState();
    context.replaceApi(createFakeApi(backend, { getToken: () => session().token, onUnauthorized: () => session().handleUnauthorized() }));
  }
  return context;
}
