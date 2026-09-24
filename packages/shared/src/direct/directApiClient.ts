import type { ApiClient, EpgGridQuery, LibraryListQuery } from '../api/apiClient';
import { ApiError } from '../api/httpClient';
import type {
  AccountDto,
  CatalogSection,
  EpgChannelRow,
  EpgGrid,
  EpgListing,
  LibrarySection,
  LibraryStatusProgress,
  LiveChannel,
  LoginRequest,
  MasterCard,
  MasterDetails,
  MediaKind,
  ProfileDto,
  ProfileRequest,
  ProgressDto,
  ProgressKind,
  ProgressRequest,
} from '../api/types';
import type { KeyValueStorage } from '../stores/storage';
import { buildMastersInChunks, type Master } from './normalizer/pipeline';
import { sha1Hex } from './normalizer/sha1';
import { createXtreamClient, normalizeServerUrl, type XtreamAccountInfo, type XtreamClient } from './xtream';

/** `ApiClient` that runs on the device and talks to the provider directly (D-038). Same results as the backend endpoints. */
export interface DirectApiClientOptions {
  appName: string;
  /** Credentials. TV: expo-secure-store. */
  secureStorage: KeyValueStorage;
  /** Profiles, progress and the library cache (can be large). TV: files in app storage. */
  dataStorage: KeyValueStorage;
  fetch?: typeof fetch;
  userAgent?: string;
  now?: () => Date;
  randomId?: () => string;
}

interface StoredCredentials {
  serverUrl: string;
  username: string;
  password: string;
  account: AccountDto;
  info: XtreamAccountInfo;
}

interface StoredProfile extends ProfileDto {
  createdAt: string;
}

interface StoredLibrary {
  builtAt: string;
  movie: Master[];
  series: Master[];
}

type LibraryKind = 'movie' | 'series';

const CREDENTIALS_KEY = 'direct.credentials';
const profilesKey = (accountId: string) => `direct.profiles.${accountId}`;
const progressKey = (profileId: string) => `direct.progress.${profileId}`;
const libraryKey = (accountId: string) => `direct.library.${accountId}`;

const CATALOG_CACHE_MS = 15 * 60_000;
const SHORT_EPG_CACHE_MS = 30 * 60_000;
const SHORT_EPG_LIMIT = 12;
const SHORT_EPG_PARALLELISM = 4;
const LIBRARY_REFRESH_MS = 12 * 3600_000;
const SLOT_MS = 30 * 60_000;
const MAX_PROFILES = 5;
const MAX_PROFILE_NAME = 50;

const notFound = () => new ApiError(404, 'not_found', 'Not found.');
const validation = (message: string) => new ApiError(400, 'validation_failed', message);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Ordinal compare, like the backend's SQLite ORDER BY and StringComparer.Ordinal. */
const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function uuidFromHash(text: string): string {
  const hex = sha1Hex(text);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const randomUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });

async function readJson<T>(storage: KeyValueStorage, key: string): Promise<T | null> {
  try {
    const text = await storage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

const writeJson = async (storage: KeyValueStorage, key: string, value: unknown) => storage.setItem(key, JSON.stringify(value));

export function createDirectApiClient(options: DirectApiClientOptions): ApiClient {
  const now = options.now ?? (() => new Date());
  const newId = options.randomId ?? randomUuid;
  let credentials: StoredCredentials | null | undefined;
  let xtream: XtreamClient | null = null;
  const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

  const connect = (stored: StoredCredentials | null) => {
    credentials = stored;
    xtream = stored ? createXtreamClient(stored, { fetch: options.fetch, userAgent: options.userAgent }) : null;
    cache.clear();
  };

  const session = async (): Promise<{ stored: StoredCredentials; client: XtreamClient }> => {
    if (credentials === undefined) connect(await readJson<StoredCredentials>(options.secureStorage, CREDENTIALS_KEY));
    if (!credentials || !xtream) throw new ApiError(401, 'unauthorized', 'Not signed in.');
    return { stored: credentials, client: xtream };
  };

  /** Promise cache: concurrent callers share one request; failures are not cached. */
  const cached = <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
    const value = load();
    cache.set(key, { expires: Date.now() + ttlMs, value });
    value.catch(() => cache.delete(key));
    return value;
  };

  const orNotFound = <T>(value: T | null): T => {
    if (value === null) throw notFound();
    return value;
  };

  // ---- Profiles ----
  const loadProfiles = async (accountId: string) =>
    ((await readJson<StoredProfile[]>(options.dataStorage, profilesKey(accountId))) ?? []).sort((a, b) =>
      ordinal(a.createdAt, b.createdAt),
    );
  const toProfileDto = ({ id, name, avatarKey, isKids }: StoredProfile): ProfileDto => ({ id, name, avatarKey, isKids });
  const validateProfile = (request: ProfileRequest, existing: StoredProfile[], excludeId: string | null) => {
    const name = request.name?.trim() ?? '';
    if (name.length === 0 || name.length > MAX_PROFILE_NAME) throw validation(`Name must be 1-${MAX_PROFILE_NAME} characters.`);
    if ((request.avatarKey?.length ?? 0) > 64) throw validation('Avatar key must be at most 64 characters.');
    if (existing.some((profile) => profile.id !== excludeId && profile.name.toLowerCase() === name.toLowerCase()))
      throw validation(`A profile named '${name}' already exists.`);
    return name;
  };
  const ownedProfile = async (profileId: string) => {
    const { stored } = await session();
    if (!(await loadProfiles(stored.account.id)).some((profile) => profile.id === profileId)) throw notFound();
  };

  // ---- Library (deduplicated masters, built on the device) ----
  const library: {
    accountId: string | null;
    data: StoredLibrary | null;
    running: Promise<void> | null;
    status: Record<LibraryKind, Omit<LibraryStatusProgress, 'mediaKind' | 'masterCount'>>;
  } = {
    accountId: null,
    data: null,
    running: null,
    status: {
      movie: { jobStatus: null, itemCount: null, queuedAt: null, finishedAt: null, error: null },
      series: { jobStatus: null, itemCount: null, queuedAt: null, finishedAt: null, error: null },
    },
  };
  const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const syncLibrary = (): Promise<void> => {
    if (library.running) return library.running;
    library.running = (async () => {
      const { stored, client } = await session();
      const accountId = stored.account.id;
      await loadLibrary();
      const queuedAt = now().toISOString();
      for (const kind of ['movie', 'series'] as const)
        library.status[kind] = { jobStatus: 'processing', stage: 'downloading', itemCount: null, queuedAt, finishedAt: null, error: null };
      const current = () => credentials?.account.id === accountId;
      // Both lists download at once (the slow part on a phone); grouping then runs one kind at a time.
      const downloads = {
        movie: client.movies().then((list) => list.map((m) => ({ ...m, releaseDate: null }))),
        series: client.series().then((list) => list.map((s) => ({ ...s, containerExtension: null }))),
      };
      for (const promise of Object.values(downloads)) promise.catch(() => undefined);
      for (const kind of ['movie', 'series'] as const) {
        try {
          const items = await downloads[kind];
          library.status[kind] = { ...library.status[kind], stage: 'grouping', itemCount: items.length, parsedCount: 0 };
          const masters = await buildMastersInChunks(accountId, kind, items, {
            onProgress: (parsed) => (library.status[kind] = { ...library.status[kind], parsedCount: parsed }),
          });
          if (!current()) return;
          // Publish and save before reporting "done": a watcher (or a restart) that sees "done" must also see the titles.
          library.data = { movie: [], series: [], ...library.data, builtAt: queuedAt, [kind]: masters };
          await writeJson(options.dataStorage, libraryKey(accountId), library.data).catch(() => undefined);
          library.status[kind] = { ...library.status[kind], jobStatus: 'done', stage: null, finishedAt: now().toISOString() };
        } catch (error) {
          library.status[kind] = {
            ...library.status[kind],
            jobStatus: 'failed',
            stage: null,
            finishedAt: now().toISOString(),
            error: error instanceof Error ? error.message : 'Library sync failed.',
          };
        }
        await yieldToUi();
      }
    })().finally(() => {
      library.running = null;
    });
    return library.running;
  };

  /** Loads the cached library of the signed-in account once per account. */
  // Concurrent callers (restore, status polling, rows) share one read; otherwise the second one saw "no library" and
  // started a full download although the saved copy was still being read.
  let loading: { accountId: string; promise: Promise<StoredLibrary | null> } | null = null;
  const loadLibrary = async (): Promise<StoredLibrary | null> => {
    const { stored } = await session();
    const accountId = stored.account.id;
    if (library.accountId === accountId) return library.data;
    if (loading?.accountId !== accountId) {
      const promise = readJson<StoredLibrary>(options.dataStorage, libraryKey(accountId)).then((data) => {
        if (credentials?.account.id === accountId && library.accountId !== accountId) {
          library.accountId = accountId;
          library.data = data;
          for (const kind of ['movie', 'series'] as const) {
            library.status[kind] = data
              ? { jobStatus: 'done', itemCount: null, queuedAt: data.builtAt, finishedAt: data.builtAt, error: null }
              : { jobStatus: null, itemCount: null, queuedAt: null, finishedAt: null, error: null };
          }
        }
        return library.accountId === accountId ? library.data : data;
      });
      loading = { accountId, promise };
    }
    return loading.promise;
  };

  /** Sorted list, per-category lists and id lookup, built once per library version (list() used to sort on every call). */
  const indexes = new WeakMap<Master[], { sorted: Master[]; byCategory: Map<string, Master[]>; byId: Map<string, Master> }>();
  const indexFor = (masters: Master[]) => {
    let index = indexes.get(masters);
    if (!index) {
      const sorted = [...masters].sort((a, b) => ordinal(a.title, b.title) || (a.year ?? -1) - (b.year ?? -1));
      const byCategory = new Map<string, Master[]>();
      for (const master of sorted) {
        for (const categoryId of new Set(master.variants.map((variant) => variant.categoryId))) {
          if (categoryId) byCategory.set(categoryId, [...(byCategory.get(categoryId) ?? []), master]);
        }
      }
      index = { sorted, byCategory, byId: new Map(masters.map((master) => [master.id, master])) };
      indexes.set(masters, index);
    }
    return index;
  };

  /** Cached library, refreshed in the background when older than 12 h or missing. */
  const ensureLibrary = async (): Promise<StoredLibrary | null> => {
    const data = await loadLibrary();
    const age = data ? now().getTime() - Date.parse(data.builtAt) : Infinity;
    if (age > LIBRARY_REFRESH_MS) void syncLibrary().catch(() => undefined);
    return data;
  };

  const librarySection = (section: LibrarySection): LibraryKind => (section === 'movies' ? 'movie' : 'series');

  const toCard = (master: Master): MasterCard => ({
    id: master.id,
    title: master.title,
    year: master.year,
    posterUrl: master.posterUrl,
    rating: master.rating,
    bestQuality: master.bestQuality,
    variantCount: master.variants.length,
  });

  // ---- Guide ----
  const liveChannels = async (categoryId?: string | null, signal?: AbortSignal): Promise<LiveChannel[]> => {
    const { stored, client } = await session();
    return cached(`live:${stored.account.id}:${categoryId ?? ''}`, CATALOG_CACHE_MS, () => client.liveChannels(categoryId, signal));
  };

  const shortEpg = async (channels: LiveChannel[]): Promise<Map<string, EpgListing[]>> => {
    const { stored, client } = await session();
    const result = new Map<string, EpgListing[]>();
    const queue = [...channels];
    const worker = async () => {
      for (let channel = queue.shift(); channel; channel = queue.shift()) {
        const id = channel.id;
        // Guide data is optional: a failed channel is cached as "no guide", like the backend.
        const programmes = await cached(`epg:${stored.account.id}:${id}`, SHORT_EPG_CACHE_MS, () =>
          client.shortEpg(id, SHORT_EPG_LIMIT).catch(() => [] as EpgListing[]),
        );
        result.set(id, programmes);
      }
    };
    await Promise.all(Array.from({ length: Math.min(SHORT_EPG_PARALLELISM, channels.length) }, worker));
    return result;
  };

  const epgGrid = async (query: EpgGridQuery = {}, signal?: AbortSignal): Promise<EpgGrid> => {
    const current = now();
    const from = query.from ? new Date(query.from) : new Date(Math.floor(current.getTime() / SLOT_MS) * SLOT_MS);
    const to = new Date(from.getTime() + clamp(query.hours ?? 3, 1, 12) * 3600_000);
    const channels = await liveChannels(query.categoryId, signal);
    const offset = Math.max(0, query.offset ?? 0);
    const page = channels.slice(offset, offset + clamp(query.limit ?? 50, 1, 200));
    const programmes = await shortEpg(page);
    const rows: EpgChannelRow[] = page.map((channel) => ({
      channel,
      programmes: (programmes.get(channel.id) ?? [])
        .filter((programme) => Date.parse(programme.end) > from.getTime() && Date.parse(programme.start) < to.getTime())
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    }));
    return {
      status: 'ready',
      updatedAt: current.toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      totalChannels: channels.length,
      channels: rows,
    };
  };

  const catalogKind: Record<CatalogSection, MediaKind> = { live: 'live', movies: 'movie', series: 'series' };

  return {
    health: async () => ({ status: 'ok', app: options.appName }),

    auth: {
      async login(request: LoginRequest) {
        if (!request.username?.trim() || !request.password) throw validation('Username and password are required.');
        const serverUrl = normalizeServerUrl(request.serverUrl ?? '');
        const username = request.username.trim();
        const client = createXtreamClient(
          { serverUrl, username, password: request.password },
          { fetch: options.fetch, userAgent: options.userAgent },
        );
        const info = await client.validate();
        const account: AccountDto = {
          id: uuidFromHash(`${serverUrl}|${username}`),
          providerType: 'xtream',
          serverUrl,
          username,
          status: info.status,
          expiresAt: info.expiresAt,
          maxConnections: info.maxConnections,
        };
        const stored: StoredCredentials = { serverUrl, username, password: request.password, account, info };
        await writeJson(options.secureStorage, CREDENTIALS_KEY, stored);
        connect(stored);
        library.accountId = null;
        loading = null;

        let profiles = await loadProfiles(account.id);
        if (profiles.length === 0) {
          profiles = [
            { id: newId(), name: username.slice(0, MAX_PROFILE_NAME), avatarKey: null, isKids: false, createdAt: now().toISOString() },
          ];
          await writeJson(options.dataStorage, profilesKey(account.id), profiles);
        }
        void ensureLibrary()
          .then(() => syncLibrary())
          .catch(() => undefined);
        const expiresAt = new Date(now().getTime() + 365 * 24 * 3600_000).toISOString();
        return { token: `direct-${newId()}`, expiresAt, account, profiles: profiles.map(toProfileDto) };
      },
      async logout() {
        await options.secureStorage.removeItem(CREDENTIALS_KEY);
        connect(null);
        library.accountId = null;
        loading = null;
        library.data = null;
        return undefined;
      },
      async me() {
        const { stored } = await session();
        void ensureLibrary().catch(() => undefined);
        return stored.account;
      },
    },

    profiles: {
      async list() {
        const { stored } = await session();
        return (await loadProfiles(stored.account.id)).map(toProfileDto);
      },
      async create(request: ProfileRequest) {
        const { stored } = await session();
        const profiles = await loadProfiles(stored.account.id);
        if (profiles.length >= MAX_PROFILES) throw validation(`An account can have at most ${MAX_PROFILES} profiles.`);
        const name = validateProfile(request, profiles, null);
        const profile: StoredProfile = {
          id: newId(),
          name,
          avatarKey: request.avatarKey ?? null,
          isKids: request.isKids,
          createdAt: now().toISOString(),
        };
        await writeJson(options.dataStorage, profilesKey(stored.account.id), [...profiles, profile]);
        return toProfileDto(profile);
      },
      async update(profileId: string, request: ProfileRequest) {
        const { stored } = await session();
        const profiles = await loadProfiles(stored.account.id);
        const existing = profiles.find((profile) => profile.id === profileId);
        if (!existing) throw notFound();
        const updated = {
          ...existing,
          name: validateProfile(request, profiles, profileId),
          avatarKey: request.avatarKey ?? null,
          isKids: request.isKids,
        };
        await writeJson(
          options.dataStorage,
          profilesKey(stored.account.id),
          profiles.map((profile) => (profile.id === profileId ? updated : profile)),
        );
        return toProfileDto(updated);
      },
      async remove(profileId: string) {
        const { stored } = await session();
        const profiles = await loadProfiles(stored.account.id);
        if (!profiles.some((profile) => profile.id === profileId)) throw notFound();
        if (profiles.length === 1) throw validation('The last profile cannot be deleted.');
        await writeJson(
          options.dataStorage,
          profilesKey(stored.account.id),
          profiles.filter((profile) => profile.id !== profileId),
        );
        await options.dataStorage.removeItem(progressKey(profileId));
        return undefined;
      },
    },

    progress: {
      async list(profileId: string, limit?: number) {
        await ownedProfile(profileId);
        const items = (await readJson<ProgressDto[]>(options.dataStorage, progressKey(profileId))) ?? [];
        return items.sort((a, b) => ordinal(b.updatedAt, a.updatedAt)).slice(0, clamp(limit ?? 50, 1, 200));
      },
      async save(profileId: string, kind: ProgressKind, itemId: string, request: ProgressRequest) {
        await ownedProfile(profileId);
        const items = (await readJson<ProgressDto[]>(options.dataStorage, progressKey(profileId))) ?? [];
        const saved: ProgressDto = {
          kind,
          itemId,
          title: request.title,
          masterId: request.masterId ?? null,
          seriesId: request.seriesId ?? null,
          seasonNumber: request.seasonNumber ?? null,
          episodeNumber: request.episodeNumber ?? null,
          posterUrl: request.posterUrl ?? null,
          containerExtension: request.containerExtension ?? null,
          positionSeconds: Math.max(0, request.positionSeconds),
          durationSeconds: Math.max(0, request.durationSeconds),
          updatedAt: now().toISOString(),
        };
        const others = items.filter((item) => !(item.kind === kind && item.itemId === itemId));
        await writeJson(options.dataStorage, progressKey(profileId), [saved, ...others]);
        return saved;
      },
      async remove(profileId: string, kind: ProgressKind, itemId: string) {
        await ownedProfile(profileId);
        const items = (await readJson<ProgressDto[]>(options.dataStorage, progressKey(profileId))) ?? [];
        await writeJson(
          options.dataStorage,
          progressKey(profileId),
          items.filter((item) => !(item.kind === kind && item.itemId === itemId)),
        );
        return undefined;
      },
    },

    catalog: {
      async categories(section: CatalogSection, signal?: AbortSignal) {
        const { stored, client } = await session();
        return cached(`categories:${stored.account.id}:${section}`, CATALOG_CACHE_MS, () =>
          client.categories(catalogKind[section], signal),
        );
      },
      liveChannels,
      async movies(categoryId?: string | null, signal?: AbortSignal) {
        const { stored, client } = await session();
        return cached(`movies:${stored.account.id}:${categoryId ?? ''}`, CATALOG_CACHE_MS, () => client.movies(categoryId, signal));
      },
      async movie(movieId: string, signal?: AbortSignal) {
        const { stored, client } = await session();
        return orNotFound(await cached(`movie:${stored.account.id}:${movieId}`, CATALOG_CACHE_MS, () => client.movie(movieId, signal)));
      },
      async series(categoryId?: string | null, signal?: AbortSignal) {
        const { stored, client } = await session();
        return cached(`series:${stored.account.id}:${categoryId ?? ''}`, CATALOG_CACHE_MS, () => client.series(categoryId, signal));
      },
      async seriesDetails(seriesId: string, signal?: AbortSignal) {
        const { stored, client } = await session();
        return orNotFound(
          await cached(`series-details:${stored.account.id}:${seriesId}`, CATALOG_CACHE_MS, () => client.seriesDetails(seriesId, signal)),
        );
      },
    },

    library: {
      async sync() {
        await session();
        void syncLibrary().catch(() => undefined);
        return undefined;
      },
      async status() {
        const data = await ensureLibrary();
        return (['movie', 'series'] as const).map((kind) => ({
          mediaKind: kind,
          ...library.status[kind],
          masterCount: data?.[kind].length ?? 0,
        }));
      },
      async list(section: LibrarySection, query: LibraryListQuery = {}) {
        const index = indexFor((await ensureLibrary())?.[librarySection(section)] ?? []);
        const search = query.search?.trim().toLowerCase();
        const scope = query.categoryId ? (index.byCategory.get(query.categoryId) ?? []) : index.sorted;
        const matches = search
          ? scope.filter((master) => master.normalizedKey.includes(search) || master.title.toLowerCase().includes(search))
          : scope;
        const offset = Math.max(0, query.offset ?? 0);
        return { total: matches.length, items: matches.slice(offset, offset + clamp(query.limit ?? 100, 1, 500)).map(toCard) };
      },
      async get(section: LibrarySection, masterId: string): Promise<MasterDetails> {
        const master = indexFor((await ensureLibrary())?.[librarySection(section)] ?? []).byId.get(masterId);
        if (!master) throw notFound();
        const variants = [...master.variants]
          .sort((a, b) => b.qualityScore - a.qualityScore || ordinal(a.label, b.label))
          .map((variant) => ({
            streamId: variant.streamId,
            label: variant.label,
            quality: variant.quality,
            source: variant.source,
            audioLanguages: variant.audioLanguages,
            audioTag: variant.audioTag,
            isHdr: variant.isHdr,
            containerExtension: variant.containerExtension,
            categoryId: variant.categoryId,
            rawTitle: variant.rawTitle,
          }));
        const { variantCount: _count, ...card } = toCard(master);
        return { ...card, variants };
      },
    },

    epg: {
      grid: epgGrid,
      async refresh() {
        const { stored } = await session();
        for (const key of [...cache.keys()]) if (key.startsWith(`epg:${stored.account.id}:`)) cache.delete(key);
        return undefined;
      },
    },

    playback: {
      async get(kind, id, container) {
        const { stored, client } = await session();
        return { ...client.playbackUrl(kind, id, container, stored.info), deliveryMode: 'direct' };
      },
    },
  };
}
