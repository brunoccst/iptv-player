import type { HttpClient } from './httpClient';
import type {
  CatalogSection,
  LibrarySection,
  LibrarySort,
  LoginRequest,
  OperationResult,
  PlaybackKind,
  ProfileRequest,
  ProgressKind,
  ProgressRequest,
  SortOrder,
} from './types';

/** Omitted `sort` = `added`; omitted `order` = `desc` for dates, `asc` for titles (D-049). */
export interface LibraryListQuery {
  categoryId?: string | null;
  search?: string | null;
  offset?: number;
  limit?: number;
  sort?: LibrarySort;
  order?: SortOrder;
}

/** `from` is an ISO timestamp; the backend defaults it to the current half hour. */
export interface EpgGridQuery {
  categoryId?: string | null;
  from?: string | null;
  hours?: number;
  offset?: number;
  limit?: number;
}

const segment = encodeURIComponent;

/** Typed wrapper for every backend endpoint. Return types come from the generated OpenAPI operations. */
export function createApiClient(http: HttpClient) {
  const get = <T>(path: string, query?: Record<string, string | number | null | undefined>, signal?: AbortSignal) =>
    http.request<T>('GET', path, { query, signal });

  return {
    health: (signal?: AbortSignal) => get<OperationResult<'getHealth'>>('/api/health', undefined, signal),

    auth: {
      login: (request: LoginRequest) => http.request<OperationResult<'login'>>('POST', '/api/auth/login', { body: request }),
      logout: () => http.request<OperationResult<'logout', 204>>('POST', '/api/auth/logout'),
      me: (signal?: AbortSignal) => get<OperationResult<'getMe'>>('/api/auth/me', undefined, signal),
    },

    profiles: {
      list: (signal?: AbortSignal) => get<OperationResult<'listProfiles'>>('/api/profiles', undefined, signal),
      create: (request: ProfileRequest) => http.request<OperationResult<'createProfile', 201>>('POST', '/api/profiles', { body: request }),
      update: (profileId: string, request: ProfileRequest) =>
        http.request<OperationResult<'updateProfile'>>('PUT', `/api/profiles/${segment(profileId)}`, { body: request }),
      remove: (profileId: string) => http.request<OperationResult<'deleteProfile', 204>>('DELETE', `/api/profiles/${segment(profileId)}`),
    },

    progress: {
      list: (profileId: string, limit?: number, signal?: AbortSignal) =>
        get<OperationResult<'listProgress'>>(`/api/profiles/${segment(profileId)}/progress`, { limit }, signal),
      save: (profileId: string, kind: ProgressKind, itemId: string, request: ProgressRequest) =>
        http.request<OperationResult<'saveProgress'>>('PUT', `/api/profiles/${segment(profileId)}/progress/${kind}/${segment(itemId)}`, {
          body: request,
        }),
      remove: (profileId: string, kind: ProgressKind, itemId: string) =>
        http.request<OperationResult<'deleteProgress', 204>>(
          'DELETE',
          `/api/profiles/${segment(profileId)}/progress/${kind}/${segment(itemId)}`,
        ),
    },

    catalog: {
      categories: (section: CatalogSection, signal?: AbortSignal) =>
        get<OperationResult<'listMovieCategories'>>(`/api/catalog/${section}/categories`, undefined, signal),
      liveChannels: (categoryId?: string | null, signal?: AbortSignal) =>
        get<OperationResult<'listLiveChannels'>>('/api/catalog/live/channels', { categoryId }, signal),
      movies: (categoryId?: string | null, signal?: AbortSignal) =>
        get<OperationResult<'listMovies'>>('/api/catalog/movies', { categoryId }, signal),
      movie: (movieId: string, signal?: AbortSignal) =>
        get<OperationResult<'getMovie'>>(`/api/catalog/movies/${segment(movieId)}`, undefined, signal),
      series: (categoryId?: string | null, signal?: AbortSignal) =>
        get<OperationResult<'listSeries'>>('/api/catalog/series', { categoryId }, signal),
      seriesDetails: (seriesId: string, signal?: AbortSignal) =>
        get<OperationResult<'getSeries'>>(`/api/catalog/series/${segment(seriesId)}`, undefined, signal),
    },

    library: {
      sync: () => http.request<OperationResult<'syncLibrary', 202>>('POST', '/api/library/sync'),
      status: (signal?: AbortSignal) => get<OperationResult<'getLibraryStatus'>>('/api/library/status', undefined, signal),
      list: (section: LibrarySection, query: LibraryListQuery = {}, signal?: AbortSignal) =>
        get<OperationResult<'listLibrary'>>(`/api/library/${section}`, { ...query }, signal),
      get: (section: LibrarySection, masterId: string, signal?: AbortSignal) =>
        get<OperationResult<'getLibraryItem'>>(`/api/library/${section}/${segment(masterId)}`, undefined, signal),
    },

    epg: {
      grid: (query: EpgGridQuery = {}, signal?: AbortSignal) => get<OperationResult<'getEpgGrid'>>('/api/epg', { ...query }, signal),
      refresh: () => http.request<OperationResult<'refreshEpg', 202>>('POST', '/api/epg/refresh'),
    },

    playback: {
      get: (kind: PlaybackKind, id: string, container?: string | null, signal?: AbortSignal) =>
        get<OperationResult<'getPlayback'>>(`/api/playback/${kind}/${segment(id)}`, { container }, signal),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
