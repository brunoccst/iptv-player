import { ApiError } from '../api/httpClient';
import type {
  Episode,
  EpgListing,
  LiveChannel,
  MediaCategory,
  MediaKind,
  MovieDetails,
  MovieSummary,
  PlaybackKind,
  Season,
  SeriesDetails,
  SeriesSummary,
} from '../api/types';
import { decodeMaybeBase64 } from './base64Text';
import { bool, int, isObject, items, num, prop, str, strList, unixTime, type Json } from './looseJson';

/** Direct-mode port of backend XtreamCodesProvider (D-011, D-038). Same DTOs, so screens do not notice the difference. */
export interface XtreamCredentials {
  /** Normalized with `normalizeServerUrl`: scheme + host + path, trailing slash. */
  serverUrl: string;
  username: string;
  password: string;
}

export interface XtreamAccountInfo {
  status: string;
  expiresAt: string | null;
  maxConnections: number | null;
  allowedOutputFormats: string[];
}

export interface XtreamClientOptions {
  fetch?: typeof fetch;
  /** Sent on every provider request; many panels only answer player-like agents. */
  userAgent?: string;
  timeoutMs?: number;
}

const KNOWN_ENDPOINT_FILES = ['player_api.php', 'get.php', 'xmltv.php', 'panel_api.php'];

export function normalizeServerUrl(serverUrl: string): string {
  let text = serverUrl.trim();
  if (!text) throw new ApiError(400, 'validation_failed', 'Server URL is required.');
  if (!text.includes('://')) text = `http://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new ApiError(400, 'validation_failed', 'Server URL must be an http(s) address.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new ApiError(400, 'validation_failed', 'Server URL must be an http(s) address.');
  let path = url.pathname.replace(/\/+$/, '');
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (KNOWN_ENDPOINT_FILES.includes(last.toLowerCase())) path = path.slice(0, path.lastIndexOf('/'));
  return `${url.protocol}//${url.host}${path}/`;
}

const unavailable = (message: string) => new ApiError(502, 'provider_unavailable', message);

export function createXtreamClient(credentials: XtreamCredentials, options: XtreamClientOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;

  const host = () => {
    try {
      return new URL(credentials.serverUrl).host;
    } catch {
      return 'the provider';
    }
  };

  const buildUrl = (file: string, query: Record<string, string>) => {
    const all = { username: credentials.username, password: credentials.password, ...query };
    const search = Object.entries(all)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    return `${credentials.serverUrl}${file}?${search}`;
  };

  const getJson = async (action: string | null, parameters: Record<string, string> = {}, signal?: AbortSignal): Promise<Json> => {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    const operation = action ?? 'login';
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    let response: Response;
    try {
      const url = buildUrl('player_api.php', action ? { action, ...parameters } : parameters);
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json', ...(options.userAgent ? { 'User-Agent': options.userAgent } : {}) },
        signal: controller.signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new ApiError(0, 'aborted', 'Request was cancelled.');
      if (timedOut) throw unavailable(`No answer from ${host()} after ${Math.round(timeoutMs / 1000)} s.`);
      throw unavailable(`Could not connect to ${host()} (${error instanceof Error ? error.message : 'network error'}).`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    if (response.status === 401 || response.status === 403)
      throw new ApiError(502, 'provider_credentials_rejected', 'Provider rejected the credentials.');
    if (!response.ok) throw unavailable(`${host()} answered HTTP ${response.status} for '${operation}'.`);
    // Read as text: some panels send a byte-order mark or padding that JSON.parse rejects (the backend's parser skips it).
    const text = await response.text().catch(() => '');
    try {
      return JSON.parse(text.replace(/^\uFEFF/, '').trim()) as Json;
    } catch {
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 60);
      throw unavailable(`${host()} sent a reply that is not JSON for '${operation}'${preview ? `: "${preview}"` : ' (empty)'}.`);
    }
  };

  const categoryFilter = (categoryId?: string | null): Record<string, string> => (categoryId?.trim() ? { category_id: categoryId } : {});

  const readMovieSummary = (item: Json): MovieSummary => ({
    id: str(item, 'stream_id')!,
    name: str(item, 'name') ?? '',
    categoryId: str(item, 'category_id'),
    posterUrl: str(item, 'stream_icon'),
    rating: num(item, 'rating'),
    addedAt: unixTime(item, 'added'),
    containerExtension: str(item, 'container_extension'),
  });

  const readSeriesSummary = (item: Json, seriesId: string): SeriesSummary => ({
    id: seriesId,
    name: str(item, 'name') ?? '',
    categoryId: str(item, 'category_id'),
    posterUrl: str(item, 'cover'),
    rating: num(item, 'rating'),
    plot: str(item, 'plot'),
    genre: str(item, 'genre'),
    releaseDate: str(item, 'releaseDate') ?? str(item, 'release_date'),
    lastModifiedAt: unixTime(item, 'last_modified'),
  });

  /** `episodes` is `{"1": [...]}` or `[[...], [...]]` depending on the panel. */
  const readEpisodes = (episodes: Json): Map<number, Episode[]> => {
    const groups = isObject(episodes) ? Object.values(episodes) : items(episodes);
    const bySeason = new Map<number, Episode[]>();
    for (const item of groups.flatMap(items)) {
      const id = str(item, 'id');
      const season = int(item, 'season');
      if (id === null || season === null) continue;
      const info = isObject(prop(item, 'info')) ? prop(item, 'info') : undefined;
      const episode: Episode = {
        id,
        seasonNumber: season,
        episodeNumber: int(item, 'episode_num'),
        title: str(item, 'title') ?? '',
        plot: str(info, 'plot'),
        durationSeconds: int(info, 'duration_secs'),
        stillUrl: str(info, 'movie_image'),
        containerExtension: str(item, 'container_extension'),
      };
      bySeason.set(season, [...(bySeason.get(season) ?? []), episode]);
    }
    for (const list of bySeason.values()) list.sort((a, b) => (a.episodeNumber ?? Infinity) - (b.episodeNumber ?? Infinity));
    return bySeason;
  };

  return {
    credentials,

    async validate(signal?: AbortSignal): Promise<XtreamAccountInfo> {
      const userInfo = prop(await getJson(null, {}, signal), 'user_info');
      if (!isObject(userInfo) || !bool(userInfo, 'auth'))
        throw new ApiError(401, 'invalid_provider_credentials', 'Invalid username or password.');
      const status = str(userInfo, 'status') ?? 'Unknown';
      if (status.toLowerCase() !== 'active')
        throw new ApiError(401, 'invalid_provider_credentials', `Provider account status is '${status}'.`);
      return {
        status,
        expiresAt: unixTime(userInfo, 'exp_date'),
        maxConnections: int(userInfo, 'max_connections'),
        allowedOutputFormats: strList(userInfo, 'allowed_output_formats'),
      };
    },

    async categories(kind: MediaKind, signal?: AbortSignal): Promise<MediaCategory[]> {
      const action = { live: 'get_live_categories', movie: 'get_vod_categories', series: 'get_series_categories' }[kind];
      return items(await getJson(action, {}, signal))
        .filter((item) => str(item, 'category_id') !== null)
        .map((item) => ({ id: str(item, 'category_id')!, name: str(item, 'category_name') ?? str(item, 'category_id')!, kind }));
    },

    async liveChannels(categoryId?: string | null, signal?: AbortSignal): Promise<LiveChannel[]> {
      return items(await getJson('get_live_streams', categoryFilter(categoryId), signal))
        .filter((item) => str(item, 'stream_id') !== null)
        .map((item) => ({
          id: str(item, 'stream_id')!,
          name: str(item, 'name') ?? '',
          categoryId: str(item, 'category_id'),
          number: int(item, 'num'),
          logoUrl: str(item, 'stream_icon'),
          epgChannelId: str(item, 'epg_channel_id'),
          hasCatchup: bool(item, 'tv_archive'),
        }));
    },

    async movies(categoryId?: string | null, signal?: AbortSignal): Promise<MovieSummary[]> {
      return items(await getJson('get_vod_streams', categoryFilter(categoryId), signal))
        .filter((item) => str(item, 'stream_id') !== null)
        .map(readMovieSummary);
    },

    async movie(movieId: string, signal?: AbortSignal): Promise<MovieDetails | null> {
      const root = await getJson('get_vod_info', { vod_id: movieId }, signal);
      const movieData = prop(root, 'movie_data');
      if (str(movieData, 'stream_id') === null) return null;
      // `info` is an object on success but `[]` on some panels when empty.
      const info = isObject(prop(root, 'info')) ? prop(root, 'info') : undefined;
      return {
        summary: {
          ...readMovieSummary(movieData),
          posterUrl: str(info, 'movie_image') ?? str(info, 'cover_big'),
          rating: num(info, 'rating'),
        },
        plot: str(info, 'plot') ?? str(info, 'description'),
        genre: str(info, 'genre'),
        cast: str(info, 'cast') ?? str(info, 'actors'),
        director: str(info, 'director'),
        releaseDate: str(info, 'releasedate') ?? str(info, 'release_date'),
        durationSeconds: int(info, 'duration_secs'),
        backdropUrls: strList(info, 'backdrop_path'),
        trailerYoutubeId: str(info, 'youtube_trailer'),
        tmdbId: str(info, 'tmdb_id'),
      };
    },

    async series(categoryId?: string | null, signal?: AbortSignal): Promise<SeriesSummary[]> {
      return items(await getJson('get_series', categoryFilter(categoryId), signal))
        .filter((item) => str(item, 'series_id') !== null)
        .map((item) => readSeriesSummary(item, str(item, 'series_id')!));
    },

    async seriesDetails(seriesId: string, signal?: AbortSignal): Promise<SeriesDetails | null> {
      const root = await getJson('get_series_info', { series_id: seriesId }, signal);
      const info = prop(root, 'info');
      if (!isObject(info)) return null;
      const episodes = readEpisodes(prop(root, 'episodes'));
      const seasonMeta = new Map<number, Json>();
      for (const season of items(prop(root, 'seasons'))) {
        const number = int(season, 'season_number');
        if (number !== null && !seasonMeta.has(number)) seasonMeta.set(number, season);
      }
      const numbers = [...new Set([...episodes.keys(), ...seasonMeta.keys()])].sort((a, b) => a - b);
      const seasons: Season[] = numbers
        .map((number) => {
          const meta = seasonMeta.get(number);
          return {
            number,
            name: str(meta, 'name') ?? `Season ${number}`,
            coverUrl: str(meta, 'cover_big') ?? str(meta, 'cover'),
            episodes: episodes.get(number) ?? [],
          };
        })
        .filter((season) => season.episodes.length > 0);
      return {
        summary: readSeriesSummary(info, seriesId),
        cast: str(info, 'cast'),
        director: str(info, 'director'),
        backdropUrls: strList(info, 'backdrop_path'),
        trailerYoutubeId: str(info, 'youtube_trailer'),
        seasons,
      };
    },

    async shortEpg(channelId: string, limit: number, signal?: AbortSignal): Promise<EpgListing[]> {
      const root = await getJson('get_short_epg', { stream_id: channelId, limit: String(limit) }, signal);
      return items(prop(root, 'epg_listings')).flatMap((item) => {
        const start = unixTime(item, 'start_timestamp');
        const end = unixTime(item, 'stop_timestamp');
        const title = decodeMaybeBase64(str(item, 'title'));
        if (!start || !end || end <= start || !title?.trim()) return [];
        return [{ start, end, title, description: decodeMaybeBase64(str(item, 'description')) }];
      });
    },

    /** Direct provider URL. Live prefers HLS unless the account only allows other formats. */
    playbackUrl(kind: PlaybackKind, id: string, container: string | null | undefined, account: XtreamAccountInfo | null) {
      const clean = sanitizeContainer(container);
      const segment = kind === 'episode' ? 'series' : kind;
      const chosen = kind === 'live' ? chooseLiveContainer(clean, account?.allowedOutputFormats ?? []) : (clean ?? 'mp4');
      const path = [segment, credentials.username, credentials.password].map(encodeURIComponent).join('/');
      return { url: `${credentials.serverUrl}${path}/${encodeURIComponent(id)}.${chosen}`, container: chosen, isLive: kind === 'live' };
    },
  };
}

export type XtreamClient = ReturnType<typeof createXtreamClient>;

function sanitizeContainer(container: string | null | undefined): string | null {
  const value = container?.trim().replace(/^\.+/, '').toLowerCase();
  return value && value.length <= 8 && /^[a-z0-9]+$/.test(value) ? value : null;
}

function chooseLiveContainer(requested: string | null, allowed: string[]): string {
  const preferred = requested ?? 'm3u8';
  const lower = allowed.map((format) => format.toLowerCase());
  if (lower.length === 0 || lower.includes(preferred)) return preferred;
  return lower.includes('m3u8') ? 'm3u8' : 'ts';
}
