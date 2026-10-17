import type { ApiClient, CatalogOptions, EpgGridQuery, LibraryListQuery } from '../api/apiClient';
import { ApiError } from '../api/errors';
import type {
  AccountDto,
  CatalogSection,
  EpgChannelRow,
  EpgGrid,
  EpgListing,
  LibrarySection,
  LibrarySort,
  LibraryChanges,
  LibraryStatusProgress,
  LiveChannel,
  ProgrammeMatch,
  LoginRequest,
  MasterCard,
  MasterDetails,
  MediaKind,
  ProfileDto,
  ProfileRequest,
  ProgressDto,
  ProgressKind,
  ProgressRequest,
  SortOrder,
  WatchlistDto,
  WatchlistLowSource,
  WatchlistRequest,
} from '../api/types';
import type { KeyValueStorage } from '../stores/storage';
import { appLog, errorMessage } from '../utils/logger';
import { LIBRARY_FORMAT, packLibraryText, readLibraryText } from './libraryCodec';
import { createListSnapshot } from './listSnapshot';
import { createSqlCatalogCache } from './sqlCatalogCache';
import {
  createSqlGuide,
  createSqlLibrary,
  createSqlLiveChannels,
  type SavedItems,
  type SqlDatabase,
  type SqlGuide,
  type SqlLibraryKind,
  type SqlLiveChannels,
} from './sqlLibrary';
import type { GuideProgramme } from './xmltv';
import { floorToSlot } from '../epg/guide';
import { reattachTitles, type TitleLookup } from './reattach';
import { buildMastersInChunks, lowSourceOf, tmdbId, type Master, type NormalizerItem } from './normalizer/pipeline';
import { sha1Hex } from './normalizer/sha1';
import { createXtreamClient, normalizeServerUrl, type ListReader, type XtreamAccountInfo, type XtreamClient } from './xtream';
import { t } from '../i18n/i18n';

/** The app's `ApiClient`: runs on the device and talks to the provider directly (D-088). */
export interface DirectApiClientOptions {
  appName: string;
  /** Credentials. TV: expo-secure-store. */
  secureStorage: KeyValueStorage;
  /** Profiles, progress and the library cache (can be large). TV: files in app storage. */
  dataStorage: KeyValueStorage;
  fetch?: typeof fetch;
  userAgent?: string;
  /** TV/phone: provider lists read by native code (D-115). */
  listReader?: ListReader;
  /** TV/phone: SHA-1 hex of many texts at once, in native code, for title ids (D-093). */
  hashIds?(texts: string[]): Promise<string[]>;
  now?: () => Date;
  randomId?: () => string;
  /** How long after the last new list the start-up snapshot is saved (D-121); tests use 0. */
  snapshotSaveMs?: number;
  /**
   * TV/phone: the library in SQLite (D-121), so a start reads a few rows instead of the whole library, and lists are
   * queries. Without it (desktop, web) the library is one file per kind, read whole into memory.
   */
  libraryDb?: SqlDatabase;
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
  /** In memory (no database); empty when `sql` is set. */
  movie: Master[];
  series: Master[];
  /** In the database (D-121): where each kind is. */
  sql?: Partial<Record<LibraryKind, SqlLibraryKind>>;
}

type LibraryKind = 'movie' | 'series';

/** Storage keys; the user-data backup (D-056) reads and writes the same ones. */
export const CREDENTIALS_KEY = 'direct.credentials';
export const profilesKey = (accountId: string) => `direct.profiles.${accountId}`;
export const progressKey = (profileId: string) => `direct.progress.${profileId}`;
export const watchlistKey = (profileId: string) => `direct.watchlist.${profileId}`;
const MAX_WATCHLIST = 500;
/** One file per kind: a finished kind never rewrites the other, and each file stays half the size. */
const libraryKey = (accountId: string, kind: LibraryKind) => `direct.library.v${LIBRARY_FORMAT}.${accountId}.${kind}`;
/** Plain-JSON files from before the compact format; deleted on load to free space. */
const oldLibraryKey = (accountId: string, kind: LibraryKind) => `direct.library.${accountId}.${kind}`;

const CATALOG_CACHE_MS = 15 * 60_000;
const SHORT_EPG_CACHE_MS = 30 * 60_000;
/** How long the database's copy stays fresh (D-121); an older one is still used when the provider cannot answer. */
const SAVED_CATEGORIES_MS = 24 * 3600_000;
const SAVED_MOVIE_MS = 7 * 24 * 3600_000;
const SAVED_SERIES_MS = 12 * 3600_000;
const SHORT_EPG_LIMIT = 12;
// Low on purpose: some providers treat bursts of guide requests as flooding (a 503 was seen at 4 in parallel).
const SHORT_EPG_PARALLELISM = 2;
/** How far back the guide keeps programmes of channels with recordings (issue #226); the apps' guides go back as far. */
const CATCHUP_GUIDE_MS = 24 * 3600_000;
const LIBRARY_REFRESH_MS = 24 * 3600_000;
/**
 * The full TV guide keeps the programmes of the next two days, as far as the guide pages (issue #248), and is
 * downloaded again after half a day (issue #119).
 */
const GUIDE_WINDOW_MS = 48 * 3600_000;
const GUIDE_REFRESH_MS = 12 * 3600_000;
const PROGRAMME_SEARCH_LIMIT = 30;
const MAX_PROFILES = 5;
const MAX_PROFILE_NAME = 50;

const notFound = () => new ApiError(404, 'not_found', 'Not found.');
const validation = (message: string) => new ApiError(400, 'validation_failed', message);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Ordinal compare (code units), so the order does not depend on the device's locale. */
const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Startup waits this long for the provider before showing the app offline. */
const ME_TIMEOUT_MS = 10_000;
const unixSeconds = (iso: string | null | undefined) => (iso ? Math.floor(Date.parse(iso) / 1000) || null : null);

/**
 * Titles with audio or subtitles in one of `languages` (D-063). Home and the grids ask for many lists at once
 * after a language change; the result is kept per list and language choice, so they share one pass over the titles.
 */
const languageScopes = new WeakMap<Master[], Map<string, Master[]>>();
function inLanguages(scope: Master[], languages: string[], categoryIds: string[] | null | undefined): Master[] {
  if (languages.length === 0) return scope;
  // A version without a language in its name passes in a category named in a chosen language, or in none (D-063).
  const hinted = new Set(categoryIds ?? []);
  const key = `${languages.join(',')}|${[...hinted].sort().join(',')}`;
  let byKey = languageScopes.get(scope);
  if (!byKey) languageScopes.set(scope, (byKey = new Map()));
  let result = byKey.get(key);
  if (!result) {
    result = scope.filter((master) =>
      master.variants.some(
        (v) =>
          languages.some((code) => v.audioLanguages.includes(code) || v.subtitleLanguages.includes(code)) ||
          (v.audioLanguages.length === 0 && v.subtitleLanguages.length === 0 && v.categoryId !== null && hinted.has(v.categoryId)),
      ),
    );
    byKey.set(key, result);
  }
  return result;
}

/** Upper-case three-letter codes from `ENG,GER`; empty for "all languages" (D-063). */
const languageCodes = (languages: string | null | undefined) => [
  ...new Set(
    (languages ?? '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{3}$/.test(code)),
  ),
];

/** D-049: missing values last, then title, year and id. */
const defaultOrder = (sort: LibrarySort): SortOrder => (sort === 'title' ? 'asc' : 'desc');
/** The provider's rating; 0 means none (D-049). */
const ratingOf = (master: Master) => (master.rating !== null && master.rating > 0 ? master.rating : null);
const sortValue = (master: Master, sort: LibrarySort) =>
  sort === 'added' ? master.addedAt : sort === 'rating' ? ratingOf(master) : master.releaseKey;
function compareMasters(sort: LibrarySort, order: SortOrder) {
  const sign = order === 'desc' ? -1 : 1;
  return (a: Master, b: Master) => {
    const x = sort === 'title' ? null : sortValue(a, sort);
    const y = sort === 'title' ? null : sortValue(b, sort);
    const result =
      sort === 'title'
        ? sign * ordinal(a.title, b.title)
        : x === null || y === null
          ? (x === null ? 1 : 0) - (y === null ? 1 : 0)
          : sign * (x - y);
    return result || ordinal(a.title, b.title) || (a.year ?? -1) - (b.year ?? -1) || ordinal(a.id, b.id);
  };
}
/**
 * Titles added, changed and removed against the last library (D-119); null on a first build. A reused title is
 * unchanged; any other title whose id was there before counts as changed.
 */
function changesSince(previous: Master[] | undefined, masters: Master[], reused: number): LibraryChanges | null {
  if (!previous?.length) return null;
  const before = new Set(previous.map((master) => master.id));
  let kept = 0;
  for (const master of masters) if (before.has(master.id)) kept++;
  return { added: masters.length - kept, changed: Math.max(0, kept - reused), removed: before.size - kept };
}

/** A sorted copy; a list already in that order (the saved library is newest first, D-121) is only checked, not sorted. */
function inOrder(masters: Master[], compare: (a: Master, b: Master) => number): Master[] {
  for (let index = 1; index < masters.length; index++) {
    if (compare(masters[index - 1]!, masters[index]!) > 0) return [...masters].sort(compare);
  }
  return [...masters];
}

/** The distinct category ids of a title's versions. */
function categoryIdsOf(master: Master): string[] {
  const ids: string[] = [];
  for (const variant of master.variants) if (variant.categoryId !== null && !ids.includes(variant.categoryId)) ids.push(variant.categoryId);
  return ids;
}

function availableSorts(masters: Master[]): LibrarySort[] {
  const sorts: LibrarySort[] = [];
  if (masters.some((master) => master.addedAt !== null)) sorts.push('added');
  sorts.push('title');
  if (masters.some((master) => master.releaseKey !== null)) sorts.push('released');
  if (masters.some((master) => ratingOf(master) !== null)) sorts.push('rating');
  return sorts;
}

function uuidFromHash(text: string): string {
  const hex = sha1Hex(text);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const randomUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });

/** Reads and parses a stored value; `null` when missing or broken. Library reads are logged (size, time, errors). */
async function readJson<T>(storage: KeyValueStorage, key: string, logged = false): Promise<T | null> {
  const started = Date.now();
  try {
    const text = await storage.getItem(key);
    if (!text) {
      if (logged) appLog.info('storage', `${key}: nothing saved`);
      return null;
    }
    const value = JSON.parse(text) as T;
    if (logged) appLog.info('storage', `${key}: read ${text.length} chars in ${Date.now() - started} ms`);
    return value;
  } catch (error) {
    appLog.error('storage', `${key}: read failed after ${Date.now() - started} ms: ${errorMessage(error)}`);
    return null;
  }
}

async function writeJson(storage: KeyValueStorage, key: string, value: unknown, logged = false): Promise<void> {
  return writeText(storage, key, () => JSON.stringify(value), logged);
}

async function writeText(storage: KeyValueStorage, key: string, build: () => string | Promise<string>, logged = false): Promise<void> {
  const started = Date.now();
  try {
    const text = await build();
    await storage.setItem(key, text);
    if (logged) appLog.info('storage', `${key}: wrote ${text.length} chars in ${Date.now() - started} ms`);
  } catch (error) {
    appLog.error('storage', `${key}: write failed after ${Date.now() - started} ms: ${errorMessage(error)}`);
    throw error;
  }
}

/** `reloadCredentials`: forget the cached login so the next call reads storage again (a restored backup, D-056). */
export type DirectApiClient = ApiClient & { reloadCredentials(): void };

export function createDirectApiClient(options: DirectApiClientOptions): DirectApiClient {
  const now = options.now ?? (() => new Date());
  const newId = options.randomId ?? randomUuid;
  let credentials: StoredCredentials | null | undefined;
  let xtream: XtreamClient | null = null;
  const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

  const connect = (stored: StoredCredentials | null) => {
    credentials = stored;
    xtream = stored
      ? createXtreamClient(stored, { fetch: options.fetch, userAgent: options.userAgent, listReader: options.listReader })
      : null;
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
    if (name.length === 0 || name.length > MAX_PROFILE_NAME)
      throw validation(t('Name must be 1-{max} characters.', { max: MAX_PROFILE_NAME }));
    if ((request.avatarKey?.length ?? 0) > 64) throw validation('Avatar key must be at most 64 characters.');
    if (existing.some((profile) => profile.id !== excludeId && profile.name.toLowerCase() === name.toLowerCase()))
      throw validation(t("A profile named '{name}' already exists.", { name }));
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
    /** Resolves once the running update is marked as "processing" (or ended early), so `sync()` can report it. */
    started: Promise<void>;
    status: Record<LibraryKind, Omit<LibraryStatusProgress, 'mediaKind' | 'masterCount'>>;
  } = {
    accountId: null,
    data: null,
    running: null,
    started: Promise.resolve(),
    status: {
      movie: { jobStatus: null, itemCount: null, queuedAt: null, finishedAt: null, error: null },
      series: { jobStatus: null, itemCount: null, queuedAt: null, finishedAt: null, error: null },
    },
  };
  const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  /** Splits and merges by hand (issue #243), one at a time; an update waits for the one running. */
  let regrouping: Promise<unknown> = Promise.resolve();
  const snapshot = createListSnapshot(options.dataStorage, options.snapshotSaveMs);
  /** The library database; null without one, or after it failed to open (the library then stays in memory). */
  let sqlLibrary = options.libraryDb ? createSqlLibrary(options.libraryDb, yieldToUi) : null;
  const sqlLive = options.libraryDb && sqlLibrary ? createSqlLiveChannels(options.libraryDb, sqlLibrary, yieldToUi) : null;
  const catalogDb = options.libraryDb ? createSqlCatalogCache(options.libraryDb, () => now().getTime()) : null;

  /**
   * The provider's answer, saved in the database (D-121): a copy younger than `freshMs` answers without the network;
   * an older one answers when the provider fails (offline). Without a database, only the provider.
   */
  const persisted = async <T>(accountId: string, key: string, freshMs: number, load: () => Promise<T>): Promise<T> => {
    if (!catalogDb) return load();
    const saved = await catalogDb.get(accountId, key).catch((error: unknown) => {
      appLog.warn('storage', `${key}: saved copy could not be read: ${errorMessage(error)}`);
      return null;
    });
    if (saved && now().getTime() - saved.savedAt < freshMs) return saved.value as T;
    try {
      const value = await load();
      if (value !== null && value !== undefined)
        void catalogDb
          .put(accountId, key, value)
          .catch((error: unknown) => appLog.warn('storage', `${key}: not saved: ${errorMessage(error)}`));
      return value;
    } catch (error) {
      if (saved) return saved.value as T;
      throw error;
    }
  };
  const count = (data: StoredLibrary | null, kind: LibraryKind) => (data?.sql ? (data.sql[kind]?.count ?? 0) : (data?.[kind].length ?? 0));
  /** Kinds whose new library is being saved: their lists are not kept meanwhile (the snapshot would be ahead of the file). */
  const saving = new Set<LibraryKind>();

  /**
   * A saved library, read and unpacked in slices so the screen keeps running (D-121). The Log says where the
   * time went: reading the files, or reading the titles from the text.
   */
  const readSavedLibrary = async (key: string) => {
    const started = Date.now();
    try {
      const text = await options.dataStorage.getItem(key);
      if (!text) {
        appLog.info('storage', `${key}: nothing saved`);
        return null;
      }
      const read = Date.now();
      await yieldToUi();
      const titlesStarted = Date.now();
      const library = await readLibraryText(text, yieldToUi);
      appLog.info(
        'storage',
        `${key}: read ${text.length} chars in ${Date.now() - started} ms (file ${read - started} ms, titles ${Date.now() - titlesStarted} ms` +
          `${library?.pieces ? ` in ${library.pieces} pieces` : ', in one piece'})`,
      );
      return library;
    } catch (error) {
      appLog.error('storage', `${key}: read failed after ${Date.now() - started} ms: ${errorMessage(error)}`);
      return null;
    }
  };

  const syncLibrary = (): Promise<void> => {
    if (library.running) return library.running;
    let markStarted: () => void = () => undefined;
    library.started = new Promise<void>((resolve) => (markStarted = resolve));
    library.running = (async () => {
      const { stored, client } = await session();
      const accountId = stored.account.id;
      await loadLibrary();
      // The last library, when built with the current title rules (older rules load as built at time 0): unchanged names
      // and titles are reused, so a daily update only works on what changed (D-135).
      const previous = library.data && Date.parse(library.data.builtAt) > 0 ? library.data : null;
      const queuedAt = now().toISOString();
      appLog.info('library', `sync started (saved copy: ${library.data ? `built ${library.data.builtAt}` : 'none'})`);
      for (const kind of ['movie', 'series'] as const)
        library.status[kind] = { jobStatus: 'processing', stage: 'downloading', itemCount: null, queuedAt, finishedAt: null, error: null };
      markStarted();
      // A guide still downloading would share the connection with the lists: it stops, and comes again after the
      // channel list that follows this update (D-135).
      guide.stop?.abort();
      // "Update library" also refreshes the categories (D-121), and the saved channel list once the library is done
      // (D-121, D-135): saving 20k+ channels and the full guide at the same time slowed the library down.
      for (const key of [...cache.keys()]) if (key.startsWith(`categories:${accountId}:`)) cache.delete(key);
      void catalogDb?.forget(accountId, 'categories:').catch(() => undefined);
      const current = () => credentials?.account.id === accountId;
      const started = Date.now();
      const seconds = () => Math.round((Date.now() - started) / 1000);
      const download = (kind: LibraryKind): Promise<NormalizerItem[]> =>
        kind === 'movie'
          ? client.movies().then((list) => list.map((m) => ({ ...m, releaseDate: null, addedAt: unixSeconds(m.addedAt) })))
          : client.series().then((list) => list.map((s) => ({ ...s, containerExtension: null, addedAt: unixSeconds(s.lastModifiedAt) })));
      const failed = (kind: LibraryKind, error: unknown) => {
        appLog.error('library', `${kind}: sync failed: ${errorMessage(error)}`);
        library.status[kind] = {
          ...library.status[kind],
          jobStatus: 'failed',
          stage: null,
          finishedAt: now().toISOString(),
          error: error instanceof Error ? error.message : 'Library sync failed.',
        };
      };

      const database = sqlLibrary;
      if (database) {
        // The database groups each kind as soon as its list is in, both at once (D-135): their steps take turns, so
        // series, usually far fewer, no longer wait for 100k movies. With native code the list is saved while it
        // downloads and never comes to JavaScript.
        const build = async (kind: LibraryKind): Promise<void> => {
          let table: string | null = null;
          try {
            let source: NormalizerItem[] | SavedItems;
            let itemCount: number;
            let withTmdb: number;
            if (client.savesLists) {
              table = await database.createItems();
              const savedList = await client.saveList(kind, `${table}_r`);
              source = { table, fingerprint: savedList.fingerprint };
              itemCount = savedList.saved;
              withTmdb = savedList.tmdb;
            } else {
              const items = await download(kind);
              source = items;
              itemCount = items.length;
              withTmdb = items.filter((item) => tmdbId(item)).length;
            }
            appLog.info(
              'library',
              `${kind}: ${itemCount} items ${table ? 'downloaded and saved' : 'downloaded'} in ${seconds()} s, ${withTmdb} with a TMDB id`,
            );
            const groupStarted = Date.now();
            library.status[kind] = { ...library.status[kind], stage: 'grouping', itemCount, parsedCount: 0 };
            // The database keeps the items and groups them itself; only new names are read here (D-133).
            await regrouping;
            saving.add(kind);
            try {
              const built = database.build(accountId, kind, queuedAt, source, {
                hashIds: options.hashIds,
                onProgress: (fraction) =>
                  (library.status[kind] = { ...library.status[kind], parsedCount: Math.floor(itemCount * fraction) }),
                onTimings: (time) => {
                  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
                  if (time.sameList) {
                    appLog.info('library', `${kind}: the same list as last time, nothing to compare`);
                    return;
                  }
                  appLog.info(
                    'library',
                    `${kind}: ${Array.isArray(source) ? `saved ${itemCount} items in ${s(time.items)}, ` : ''}read ${time.newNames} new names in ` +
                      `${s(time.names)}, ` +
                      (time.changedKeys === null
                        ? 'nothing to compare with, '
                        : `compared in ${s(time.compare)} (${time.changedKeys} changed title keys), `) +
                      (time.changedKeys === 0
                        ? 'unchanged'
                        : `grouped in ${s(time.grouping)}, ${time.builtTitles} titles built, ids ${s(time.ids)}, ` +
                          `titles ${s(time.titles)}${time.inPlace ? ' (updated in place)' : ''}`),
                  );
                },
              });
              table = null; // The build drops its tables if it fails.
              const { saved, changes } = await built;
              appLog.info('library', `${kind}: ${saved.count} titles in ${Date.now() - groupStarted} ms`);
              if (!current()) return;
              library.data = { movie: [], series: [], ...library.data, builtAt: queuedAt, sql: { ...library.data?.sql, [kind]: saved } };
              library.status[kind] = {
                ...library.status[kind],
                jobStatus: 'done',
                stage: null,
                parsedCount: itemCount,
                finishedAt: now().toISOString(),
                changes,
              };
            } finally {
              saving.delete(kind);
            }
          } catch (error) {
            if (table) void database.discard(table);
            failed(kind, error);
          }
        };
        await Promise.all([build('movie'), build('series')]);
        if (current()) void refreshLive(false);
        return;
      }

      // Without a database, in memory: both lists download at once (the slow part on a phone). Grouping runs one kind
      // at a time (one JS thread), in the order the lists arrive and the smaller first when both are in: series,
      // usually far fewer, no longer wait for 100k movies to be grouped (D-093).
      const arrived: Partial<Record<LibraryKind, { items?: NormalizerItem[]; error?: unknown; seconds: number }>> = {};
      const downloads = { movie: download('movie'), series: download('series') };
      const settle = (kind: LibraryKind) =>
        downloads[kind].then(
          (items) => {
            arrived[kind] = { items, seconds: seconds() };
            if (library.status[kind].stage === 'downloading')
              library.status[kind] = { ...library.status[kind], stage: 'waiting', itemCount: items.length };
          },
          (error: unknown) => void (arrived[kind] = { error, seconds: seconds() }),
        );
      const settled = { movie: settle('movie'), series: settle('series') };
      const grouping = new Set<LibraryKind>();
      const group = async (kind: LibraryKind): Promise<void> => {
        try {
          const download = arrived[kind]!;
          if (!download.items) throw download.error;
          const items = download.items;
          appLog.info(
            'library',
            `${kind}: ${items.length} items downloaded in ${download.seconds} s, ${items.filter((item) => tmdbId(item)).length} with a TMDB id`,
          );
          const groupStarted = Date.now();
          library.status[kind] = { ...library.status[kind], stage: 'grouping', itemCount: items.length, parsedCount: 0 };
          const before = previous && !previous.sql ? previous[kind] : undefined;
          let reused = '';
          let reusedMasters = 0;
          const masters = await buildMastersInChunks(accountId, kind, items, {
            previous: before,
            hashIds: options.hashIds,
            onReuse: (counts) => {
              reused = `, ${counts.names} names and ${counts.masters} titles unchanged`;
              reusedMasters = counts.masters;
            },
            // Where the time goes, to see what to speed up (D-093).
            onTimings: (time) => {
              const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
              appLog.info(
                'library',
                `${kind}: grouping steps: names ${s(time.names)}, keys ${s(time.keys)}, ` +
                  `titles ${s(time.titles)}, ids ${s(time.ids)}, sorting ${s(time.sort)}, ` +
                  `waiting for the screen ${s(time.waiting)} (${time.breaks} breaks)`,
              );
            },
            onProgress: (parsed) => (library.status[kind] = { ...library.status[kind], parsedCount: parsed }),
            // A smaller list that arrives meanwhile (series while 100k movies group) is grouped and shown first.
            yieldTo: () => {
              const other: LibraryKind = kind === 'movie' ? 'series' : 'movie';
              const waiting = arrived[other]?.items;
              return waiting && !grouping.has(other) && waiting.length < items.length ? start(other) : null;
            },
          });
          appLog.info('library', `${kind}: grouped into ${masters.length} titles in ${Date.now() - groupStarted} ms${reused}`);
          if (!current()) return;
          // Publish and save before reporting "done": a watcher (or a restart) that sees "done" must also see the titles.
          // Kept and saved newest first, the order Home and the lists ask for first: after a restart that list needs no
          // sort (D-121).
          const newestFirst = [...masters].sort(compareMasters('added', 'desc'));
          // The answers kept for a quick start are from the old titles: gone before the new ones are saved (D-121).
          saving.add(kind);
          try {
            await snapshot.drop(accountId, kind === 'movie' ? 'movies' : 'series');
            library.data = { movie: [], series: [], ...library.data, builtAt: queuedAt, [kind]: newestFirst };
            await writeText(
              options.dataStorage,
              libraryKey(accountId, kind),
              () => packLibraryText(queuedAt, newestFirst, yieldToUi),
              true,
            ).catch(() => undefined);
          } finally {
            saving.delete(kind);
          }
          library.status[kind] = {
            ...library.status[kind],
            jobStatus: 'done',
            stage: null,
            finishedAt: now().toISOString(),
            changes: changesSince(before, masters, reusedMasters),
          };
        } catch (error) {
          failed(kind, error);
        }
        await yieldToUi();
      };
      const start = (kind: LibraryKind) => {
        grouping.add(kind);
        return group(kind);
      };
      for (;;) {
        const pending = (['movie', 'series'] as const).filter((kind) => !grouping.has(kind));
        if (pending.length === 0) break;
        if (!pending.some((kind) => arrived[kind])) await Promise.race(pending.map((kind) => settled[kind]));
        const next = pending
          .filter((kind) => arrived[kind])
          .sort((a, b) => (arrived[a]!.items?.length ?? 0) - (arrived[b]!.items?.length ?? 0))[0]!;
        await start(next);
        if (!current()) return;
      }
    })().finally(() => {
      library.running = null;
      // Ended before marking itself (no session, the saved library failed to load): nothing to wait for.
      markStarted();
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
      const opened = sqlLibrary ? openDatabase(accountId) : Promise.resolve(null);
      const promise = opened
        .then((fromDb) => (fromDb ? fromDb.data : readFiles(accountId)))
        .then((data) => {
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

  /** A missing kind counts as very old, so the background refresh fills it in; the other kind still shows. */
  const oldestBuild = (kinds: { builtAt: string }[], complete: boolean) =>
    !complete ? new Date(0).toISOString() : kinds.map((kind) => kind.builtAt).reduce((a, b) => (a < b ? a : b));

  /** The saved files, read whole (no database: desktop, web). */
  const readFiles = (accountId: string): Promise<StoredLibrary | null> =>
    Promise.all(
      (['movie', 'series'] as const).map(async (kind) => {
        void Promise.resolve(options.dataStorage.removeItem(oldLibraryKey(accountId, kind))).catch(() => undefined);
        return readSavedLibrary(libraryKey(accountId, kind));
      }),
    ).then(([movie, series]) =>
      movie || series
        ? {
            builtAt: oldestBuild(
              [movie, series].filter((kind) => !!kind),
              !!movie && !!series,
            ),
            movie: movie?.masters ?? [],
            series: series?.masters ?? [],
          }
        : null,
    );

  /**
   * The library in the database (D-121): only its table of contents is read. A kind still in a saved file (the app
   * before D-121) is moved into the database once, then the file is removed. If the database cannot be opened, null:
   * the files are read as before.
   */
  const openDatabase = async (accountId: string): Promise<{ data: StoredLibrary | null } | null> => {
    const database = sqlLibrary!;
    try {
      const started = Date.now();
      const kinds = await database.open(accountId);
      // A file from before D-121 is not read: the provider's lists are saved and grouped again (D-133).
      for (const kind of ['movie', 'series'] as const)
        if (!kinds[kind]) void Promise.resolve(options.dataStorage.removeItem(libraryKey(accountId, kind))).catch(() => undefined);
      // The database answers at once: the snapshot of Home's lists (D-121) only served the first start, while the file
      // was moved in (D-121).
      void snapshot.forget(accountId);
      const present = Object.values(kinds);
      appLog.info(
        'storage',
        `library database opened in ${Date.now() - started} ms (movies ${kinds.movie?.count ?? 'none'}, series ${kinds.series?.count ?? 'none'})`,
      );
      if (present.length === 0) return { data: null };
      const builtAt = oldestBuild(
        present.map((kind) => ({ builtAt: kind.current ? kind.builtAt : new Date(0).toISOString() })),
        !!kinds.movie && !!kinds.series,
      );
      return { data: { builtAt, movie: [], series: [], sql: kinds } };
    } catch (error) {
      appLog.error('storage', `library database failed, using files: ${errorMessage(error)}`);
      sqlLibrary = null;
      return null;
    }
  };

  /** Per library version: id lookup, category membership and each requested order, built once (not on every list()). */
  interface LibraryIndex {
    byId: Map<string, Master>;
    /** Each title's category ids (arrays: one Set per title cost seconds for 100k titles on a TV). */
    categories: Map<string, string[]>;
    orders: Map<string, { all: Master[]; byCategory: Map<string, Master[]> }>;
  }
  const indexes = new WeakMap<Master[], LibraryIndex>();
  const indexFor = (masters: Master[]) => {
    let index = indexes.get(masters);
    if (!index) {
      const categories = new Map<string, string[]>();
      for (const master of masters) categories.set(master.id, categoryIdsOf(master));
      index = { byId: new Map(masters.map((master) => [master.id, master])), categories, orders: new Map() };
      indexes.set(masters, index);
    }
    return index;
  };
  const ordered = (masters: Master[], sort: LibrarySort, order: SortOrder) => {
    const index = indexFor(masters);
    const key = `${sort}|${order}`;
    let result = index.orders.get(key);
    if (!result) {
      const all = inOrder(masters, compareMasters(sort, order));
      const byCategory = new Map<string, Master[]>();
      for (const master of all) {
        for (const categoryId of index.categories.get(master.id) ?? []) {
          const list = byCategory.get(categoryId);
          if (list) list.push(master);
          else byCategory.set(categoryId, [master]);
        }
      }
      result = { all, byCategory };
      index.orders.set(key, result);
    }
    return result;
  };

  /** Cached library, refreshed in the background when older than 24 h or missing. */
  const ensureLibrary = async (): Promise<StoredLibrary | null> => {
    const data = await loadLibrary();
    const age = data ? now().getTime() - Date.parse(data.builtAt) : Infinity;
    if (age > LIBRARY_REFRESH_MS) void syncLibrary().catch(() => undefined);
    return data;
  };

  const librarySection = (section: LibrarySection): LibraryKind => (section === 'movies' ? 'movie' : 'series');

  /**
   * The library's titles of `section` by id and by provider item, and a stamp that changes when the library does (issue
   * #216); null while there is none (saved titles are then left as they are).
   */
  const titleLookup = async (section: LibrarySection): Promise<{ lookup: TitleLookup; stamp: string } | null> => {
    const data = await loadLibrary();
    if (!data) return null;
    const kind = librarySection(section);
    if (data.sql) {
      const saved = data.sql[kind];
      const sql = sqlLibrary;
      if (!saved || saved.packed || !sql) return null;
      return {
        // A split or merge (issue #243) moves titles without a new date.
        stamp: `${saved.table}|${saved.builtAt}|${saved.ruleSig}`,
        lookup: { itemsOf: (ids) => sql.itemsOf(saved, ids), holdersOf: (streamIds) => sql.holdersOf(saved, streamIds) },
      };
    }
    const masters = data[kind];
    if (!masters.length) return null;
    const byId = indexFor(masters).byId;
    let stamp = listStamps.get(masters);
    if (!stamp) listStamps.set(masters, (stamp = `memory|${++listStampCount}`));
    return {
      stamp,
      lookup: {
        itemsOf: async (ids) => {
          const result = new Map<string, string[]>();
          for (const id of ids) {
            const master = byId.get(id);
            if (master)
              result.set(
                id,
                master.variants.map((variant) => variant.streamId),
              );
          }
          return result;
        },
        holdersOf: async (streamIds) => {
          const wanted = new Set(streamIds);
          const result = new Map<string, string>();
          for (const master of masters)
            for (const variant of master.variants) if (wanted.has(variant.streamId)) result.set(variant.streamId, master.id);
          return result;
        },
      },
    };
  };

  /** Each in-memory title list gets its own stamp: a new list is a changed library. */
  const listStamps = new WeakMap<Master[], string>();
  let listStampCount = 0;
  /** Profile list → the library stamps it was last matched against (issue #216): once per library change, not per read. */
  const reattachedAt = new Map<string, string>();

  /**
   * Saved titles (My List, progress) whose id the library no longer has move to the title that now holds their provider
   * items (issue #216). `hints` names an entry's items; `move` gives the entry its new id. Returns null when nothing changed.
   */
  const reattach = async <T extends { masterId: string | null }>(
    listKey: string,
    entries: T[],
    sectionOf: (entry: T) => LibrarySection,
    hints: (entry: T, items: Map<string, string[]>) => { entry: T; streamIds: string[] },
    move: (entry: T, masterId: string) => T,
  ): Promise<T[] | null> => {
    let changed = false;
    let result = entries;
    for (const section of ['movies', 'series'] as const) {
      const found = await titleLookup(section);
      const key = `${listKey}|${section}`;
      if (!found || reattachedAt.get(key) === found.stamp) continue;
      const mine = result.filter((entry) => entry.masterId && sectionOf(entry) === section);
      const items = await found.lookup.itemsOf([...new Set(mine.map((entry) => entry.masterId!))]);
      const withHints = new Map(mine.map((entry) => [entry, hints(entry, items)]));
      const { moved } = await reattachTitles(
        { itemsOf: async () => items, holdersOf: found.lookup.holdersOf },
        mine.map((entry) => ({ masterId: entry.masterId!, streamIds: withHints.get(entry)!.streamIds })),
      );
      result = result.map((entry) => {
        const hinted = withHints.get(entry);
        if (!hinted) return entry;
        const target = moved.get(entry.masterId!);
        if (target) appLog.info('library', `${section}: a saved title was renamed by the provider and found again by its items`);
        const next = target ? move(hinted.entry, target) : hinted.entry;
        if (next !== entry) changed = true;
        return next;
      });
      reattachedAt.set(key, found.stamp);
    }
    return changed ? result : null;
  };

  /** A list without the titles whose every version is in a hidden category; kept per list and hidden set (D-110). */
  const withoutHiddenCache = new WeakMap<Master[], { key: string; masters: Master[] }>();
  const withoutHidden = (list: Master[], categoriesOf: Map<string, string[]>, hidden: Set<string>, ids: string[]) => {
    const key = [...ids].sort().join('|');
    const cached = withoutHiddenCache.get(list);
    if (cached?.key === key) return cached.masters;
    const masters = list.filter((master) => {
      const categories = categoriesOf.get(master.id);
      if (!categories || categories.length === 0) return true;
      for (const id of categories) if (!hidden.has(id)) return true;
      return false;
    });
    withoutHiddenCache.set(list, { key, masters });
    return masters;
  };

  const toCard = (master: Master): MasterCard => ({
    id: master.id,
    title: master.title,
    year: master.year,
    posterUrl: master.posterUrl,
    rating: master.rating,
    bestQuality: master.bestQuality,
    lowSource: lowSourceOf(master.variants.map((variant) => variant.source)),
    variantCount: master.variants.length,
  });

  const toDetails = (master: Master): MasterDetails => {
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
        subtitleLanguages: variant.subtitleLanguages,
      }));
    const { variantCount: _count, ...card } = toCard(master);
    return { ...card, variants };
  };

  /**
   * While the saved library is still being read after a start: the answer kept from the last run (D-121), if any. Home
   * then shows in a moment instead of after the whole library (15 s for 160k titles on a Chromecast).
   */
  const beforeLoad = async <T>(answer: (accountId: string) => Promise<T | null>): Promise<T | null> => {
    const { stored } = await session();
    const accountId = stored.account.id;
    if (library.accountId === accountId) return null;
    const kept = await answer(accountId);
    // Still starts the read (and the daily update when due), as a list from the library would.
    if (kept) void ensureLibrary().catch(() => undefined);
    return kept;
  };

  // ---- Live channels (in the database with one, D-121) ----
  const live: {
    accountId: string | null;
    saved: SqlLiveChannels | null;
    opening: Promise<SqlLiveChannels | null> | null;
    refreshing: Promise<void> | null;
  } = { accountId: null, saved: null, opening: null, refreshing: null };

  /** A library update running now; the channel list and the guide wait for it, so they do not slow it down (D-135). */
  const afterLibrary = () => (library.running ?? Promise.resolve()).catch(() => undefined);

  /**
   * Downloads the whole channel list and saves it in the database (one at a time), after a library update that is
   * running (`waitForLibrary`: false from the end of that update itself).
   */
  const refreshLive = (waitForLibrary = true): Promise<void> => {
    if (!sqlLive) return Promise.resolve();
    live.refreshing ??= (async () => {
      if (waitForLibrary) await afterLibrary();
      const { stored, client } = await session();
      const accountId = stored.account.id;
      const started = Date.now();
      const channels = await client.liveChannels(null);
      const downloaded = Date.now();
      const saved = await sqlLive.save(accountId, now().toISOString(), channels);
      appLog.info(
        'library',
        `live: ${channels.length} channels downloaded in ${downloaded - started} ms, saved to the database in ${Date.now() - downloaded} ms`,
      );
      if (credentials?.account.id === accountId) Object.assign(live, { accountId, saved, opening: Promise.resolve(saved) });
      // The full guide follows the channel list: daily and with "Update library" (issue #119).
      void refreshGuide();
    })()
      .catch((error: unknown) => appLog.error('library', `live: channel list failed: ${errorMessage(error)}`))
      .finally(() => (live.refreshing = null));
    return live.refreshing;
  };

  /** The account's saved channels (read once), refreshed in the background when older than a day. */
  const savedLive = async (): Promise<SqlLiveChannels | null> => {
    if (!sqlLive || !sqlLibrary) return null;
    const { stored } = await session();
    const accountId = stored.account.id;
    if (live.accountId !== accountId) {
      Object.assign(live, { accountId, saved: null });
      live.opening = sqlLive
        .open(accountId)
        .catch((error: unknown) => {
          appLog.error('storage', `live: channels could not be read from the database: ${errorMessage(error)}`);
          return null;
        })
        .then((saved) => {
          if (live.accountId === accountId && !live.saved) live.saved = saved;
          return saved;
        });
    }
    const saved = await live.opening;
    if (live.accountId !== accountId) return null;
    const current = live.saved ?? saved;
    // A first list is wanted now; a refresh can wait for a library update.
    if (!current || now().getTime() - Date.parse(current.builtAt) > LIBRARY_REFRESH_MS) void refreshLive(!!current);
    return current;
  };

  // ---- Full TV guide (issue #119, D-130): in the database with one, in memory without ----
  const sqlGuide = options.libraryDb && sqlLibrary ? createSqlGuide(options.libraryDb, sqlLibrary) : null;
  const guide: {
    accountId: string | null;
    saved: SqlGuide | null;
    opening: Promise<SqlGuide | null> | null;
    refreshing: Promise<void> | null;
    /** Stops a guide download that is saving into the database (D-135). */
    stop: AbortController | null;
    memory: { programmes: GuideProgramme[]; builtAt: number } | null;
    /** Without a database: when the grid last asked for the guide (issue #229), so a failing guide is not asked for on every page. */
    triedAt: number;
  } = { accountId: null, saved: null, opening: null, refreshing: null, stop: null, memory: null, triedAt: 0 };

  /** Downloads the provider's full guide (one at a time) and keeps the programmes of the next two days. */
  const refreshGuide = (): Promise<void> => {
    guide.refreshing ??= (async () => {
      // Saved in the database, it waits for a library update (in memory there is nothing to save).
      if (sqlGuide) await afterLibrary();
      const { stored, client } = await session();
      const accountId = stored.account.id;
      const from = now().getTime();
      const window = { from, to: from + GUIDE_WINDOW_MS };
      const started = Date.now();
      if (sqlGuide) {
        const writer = await sqlGuide.begin(accountId);
        const stop = (guide.stop = new AbortController());
        let saved: SqlGuide;
        try {
          await client.guide(
            window,
            async (batch) => {
              await writer.add(batch);
              await yieldToUi();
            },
            stop.signal,
          );
          if (stop.signal.aborted) throw new Error('stopped');
          saved = await writer.finish(now().toISOString());
        } catch (error) {
          await writer.abort();
          if (stop.signal.aborted) {
            appLog.info('library', 'guide: stopped for the library update; downloaded again after it');
            return;
          }
          throw error;
        } finally {
          if (guide.stop === stop) guide.stop = null;
        }
        appLog.info('library', `guide: ${saved.count} programmes of the next two days saved in ${Date.now() - started} ms`);
        if (credentials?.account.id === accountId) Object.assign(guide, { accountId, saved, opening: Promise.resolve(saved) });
        return;
      }
      const programmes: GuideProgramme[] = [];
      await client.guide(window, async (batch) => void programmes.push(...batch));
      appLog.info('library', `guide: ${programmes.length} programmes of the next two days read in ${Date.now() - started} ms`);
      if (credentials?.account.id === accountId) Object.assign(guide, { accountId, memory: { programmes, builtAt: from } });
    })()
      .catch((error: unknown) => appLog.warn('library', `guide: the full TV guide could not be read: ${errorMessage(error)}`))
      .finally(() => (guide.refreshing = null));
    return guide.refreshing;
  };

  /** The account's saved guide (read once); downloaded again in the background when missing or older than half a day. */
  const savedGuide = async (): Promise<SqlGuide | null> => {
    if (!sqlGuide) return null;
    const { stored } = await session();
    const accountId = stored.account.id;
    if (guide.accountId !== accountId) {
      Object.assign(guide, { accountId, saved: null, memory: null });
      guide.opening = sqlGuide
        .open(accountId)
        .catch((error: unknown) => {
          appLog.error('storage', `guide: could not be read from the database: ${errorMessage(error)}`);
          return null;
        })
        .then((saved) => {
          if (guide.accountId === accountId && !guide.saved) guide.saved = saved;
          return saved;
        });
    }
    const saved = await guide.opening;
    if (guide.accountId !== accountId) return null;
    const current = guide.saved ?? saved;
    if (!current || now().getTime() - Date.parse(current.builtAt) > GUIDE_REFRESH_MS) void refreshGuide();
    return current;
  };

  const searchProgrammes = async (search: string, options: { limit?: number } = {}): Promise<ProgrammeMatch[]> => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    const limit = options.limit ?? PROGRAMME_SEARCH_LIMIT;
    const at = now().getTime();
    if (sqlGuide && sqlLive) {
      const [saved, channels] = await Promise.all([savedGuide(), savedLive()]);
      return saved && channels ? sqlGuide.search(saved, channels, needle, at, limit) : [];
    }
    // Without a database: the guide in memory, matched against the channel list.
    const { stored } = await session();
    if (guide.accountId !== stored.account.id) Object.assign(guide, { accountId: stored.account.id, memory: null });
    // The first search waits for the guide (small without a database: a browser, for development and tests).
    if (!guide.memory) await refreshGuide();
    else if (at - guide.memory.builtAt > GUIDE_REFRESH_MS) void refreshGuide();
    const memory = guide.memory;
    if (!memory) return [];
    const matching = memory.programmes.filter((p) => p.stop > at && p.title.toLowerCase().includes(needle));
    if (!matching.length) return [];
    const byGuideId = new Map<string, LiveChannel[]>();
    for (const channel of await liveChannels(null)) {
      // Guide ids match in any case (providers mix them).
      const id = channel.epgChannelId?.toLowerCase();
      if (id) byGuideId.set(id, [...(byGuideId.get(id) ?? []), channel]);
    }
    return matching
      .sort((a, b) => Number(a.start > at) - Number(b.start > at) || a.start - b.start)
      .flatMap((p) =>
        (byGuideId.get(p.channel.toLowerCase()) ?? []).map((channel) => ({
          channel,
          programme: { title: p.title, start: new Date(p.start).toISOString(), end: new Date(p.stop).toISOString(), description: null },
        })),
      )
      .slice(0, limit);
  };

  const liveChannels = async (categoryId?: string | null, signal?: AbortSignal, options: CatalogOptions = {}): Promise<LiveChannel[]> => {
    const { stored, client } = await session();
    let saved = await savedLive();
    // Every channel, not saved yet: one download fills the database, which then answers (not two downloads).
    if (!saved && !categoryId && sqlLive) {
      await refreshLive(false);
      saved = live.saved;
    }
    if (saved && sqlLive) return (await sqlLive.list(saved, { categoryId, search: options.search, limit: options.limit })).channels;
    const list = await cached(`live:${stored.account.id}:${categoryId ?? ''}`, CATALOG_CACHE_MS, () =>
      client.liveChannels(categoryId, signal),
    );
    const needle = options.search?.trim().toLowerCase();
    const matches = needle ? list.filter((channel) => channel.name.toLowerCase().includes(needle)) : list;
    return options.limit === undefined ? matches : matches.slice(0, options.limit);
  };

  /**
   * Each channel's short EPG. A channel with recordings whose short EPG starts after `from` also gets the programmes
   * before it from the panel's full list for that channel, so its past programmes can be watched (issue #226).
   */
  const shortEpg = async (channels: LiveChannel[], from = Number.POSITIVE_INFINITY): Promise<Map<string, EpgListing[]>> => {
    const { stored, client } = await session();
    const result = new Map<string, EpgListing[]>();
    const queue = [...channels];
    const worker = async () => {
      for (let channel = queue.shift(); channel; channel = queue.shift()) {
        const id = channel.id;
        // Guide data is optional: a failed channel is cached as "no guide".
        const programmes = await cached(`epg:${stored.account.id}:${id}`, SHORT_EPG_CACHE_MS, () =>
          persisted(stored.account.id, `epg:${id}`, SHORT_EPG_CACHE_MS, () => client.shortEpg(id, SHORT_EPG_LIMIT)).catch(
            () => [] as EpgListing[],
          ),
        );
        const first = programmes.length ? Math.min(...programmes.map((programme) => Date.parse(programme.start))) : Infinity;
        if (!channel.hasCatchup || first <= from) {
          result.set(id, programmes);
          continue;
        }
        const keepFrom = now().getTime() - CATCHUP_GUIDE_MS;
        const past = await cached(`epg-past:${stored.account.id}:${id}`, SHORT_EPG_CACHE_MS, () =>
          persisted(stored.account.id, `epg-past:${id}`, SHORT_EPG_CACHE_MS, async () =>
            (await client.channelEpg(id)).filter(
              (programme) => Date.parse(programme.end) > keepFrom && Date.parse(programme.start) < first,
            ),
          ).catch(() => [] as EpgListing[]),
        );
        result.set(id, [...past.filter((programme) => Date.parse(programme.start) < first), ...programmes]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(SHORT_EPG_PARALLELISM, channels.length) }, worker));
    return result;
  };

  /**
   * The full guide's programmes for these channels in [from, to), by channel id (issue #229): what the short EPG (12
   * programmes) cannot reach. Only a guide already downloaded is used; a missing one is downloaded in the background.
   */
  const fullGuideFor = async (channels: LiveChannel[], from: number, to: number): Promise<Map<string, EpgListing[]>> => {
    const byGuideId = new Map<string, string[]>();
    for (const channel of channels) {
      const id = channel.epgChannelId?.trim().toLowerCase();
      if (id) byGuideId.set(id, [...(byGuideId.get(id) ?? []), channel.id]);
    }
    const result = new Map<string, EpgListing[]>();
    if (!byGuideId.size) return result;
    let programmes: GuideProgramme[] = [];
    try {
      if (sqlGuide) {
        const saved = await savedGuide();
        if (saved) programmes = await sqlGuide.programmes(saved, [...byGuideId.keys()], from, to);
      } else {
        const { stored } = await session();
        if (guide.accountId !== stored.account.id) Object.assign(guide, { accountId: stored.account.id, memory: null, triedAt: 0 });
        const at = now().getTime();
        if (!guide.memory ? at - guide.triedAt > GUIDE_REFRESH_MS : at - guide.memory.builtAt > GUIDE_REFRESH_MS) {
          guide.triedAt = at;
          void refreshGuide();
        }
        programmes = (guide.memory?.programmes ?? []).filter(
          (p) => p.stop > from && p.start < to && byGuideId.has(p.channel.toLowerCase()),
        );
      }
    } catch (error) {
      appLog.warn('provider', `guide: the full TV guide could not fill the grid: ${errorMessage(error)}`);
      return result;
    }
    for (const p of programmes) {
      const listing: EpgListing = {
        title: p.title,
        start: new Date(p.start).toISOString(),
        end: new Date(p.stop).toISOString(),
        description: null,
      };
      for (const id of byGuideId.get(p.channel.toLowerCase()) ?? []) result.set(id, [...(result.get(id) ?? []), listing]);
    }
    return result;
  };

  const epgGrid = async (query: EpgGridQuery = {}, signal?: AbortSignal): Promise<EpgGrid> => {
    const current = now();
    const from = query.from ? new Date(query.from) : new Date(floorToSlot(current.getTime()));
    const to = new Date(from.getTime() + clamp(query.hours ?? 3, 1, 12) * 3600_000);
    const offset = Math.max(0, query.offset ?? 0);
    const limit = clamp(query.limit ?? 50, 1, 200);
    const saved = sqlLive ? await savedLive() : null;
    let page: LiveChannel[];
    let totalChannels: number;
    if (saved && sqlLive) {
      // Only this page of channels is read (D-121).
      const found = await sqlLive.list(saved, {
        categoryId: query.categoryId,
        categoryIds: query.categoryIds,
        hiddenCategoryIds: query.hiddenCategoryIds,
        offset,
        limit,
      });
      page = found.channels;
      totalChannels = found.total;
    } else {
      const allowed = query.categoryIds ? new Set(query.categoryIds) : null;
      const hidden = query.hiddenCategoryIds?.length ? new Set(query.hiddenCategoryIds) : null;
      const channels = (await liveChannels(query.categoryId, signal)).filter(
        (channel) =>
          (!allowed || (channel.categoryId !== null && allowed.has(channel.categoryId))) &&
          (!hidden || channel.categoryId === null || !hidden.has(channel.categoryId)),
      );
      page = channels.slice(offset, offset + limit);
      totalChannels = channels.length;
    }
    const programmes = await shortEpg(page, from.getTime());
    const inWindow = (programme: EpgListing) => Date.parse(programme.end) > from.getTime() && Date.parse(programme.start) < to.getTime();
    // Where the short EPG runs out (or has nothing), the full guide fills in (issue #229, D-032).
    const short = new Map(page.map((channel) => [channel.id, (programmes.get(channel.id) ?? []).filter(inWindow)]));
    const needFill = page.filter((channel) => {
      const listed = short.get(channel.id)!;
      const covered = listed.length ? Math.max(...listed.map((programme) => Date.parse(programme.end))) : from.getTime();
      return covered < to.getTime() && covered < current.getTime() + GUIDE_WINDOW_MS;
    });
    const full = needFill.length ? await fullGuideFor(needFill, from.getTime(), to.getTime()) : new Map<string, EpgListing[]>();
    const rows: EpgChannelRow[] = page.map((channel) => {
      const listed = short.get(channel.id)!;
      const overlaps = (programme: EpgListing) =>
        listed.some((other) => Date.parse(programme.start) < Date.parse(other.end) && Date.parse(other.start) < Date.parse(programme.end));
      const filled = (full.get(channel.id) ?? []).filter((programme) => !overlaps(programme));
      return { channel, programmes: [...listed, ...filled].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)) };
    });
    return {
      status: 'ready',
      updatedAt: current.toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      totalChannels,
      channels: rows,
    };
  };

  const catalogKind: Record<CatalogSection, MediaKind> = { live: 'live', movies: 'movie', series: 'series' };

  return {
    reloadCredentials() {
      credentials = undefined;
      xtream = null;
      cache.clear();
    },

    auth: {
      async login(request: LoginRequest) {
        if (!request.username?.trim() || !request.password) throw validation(t('Username and password are required.'));
        const serverUrl = normalizeServerUrl(request.serverUrl ?? '');
        const username = request.username.trim();
        const client = createXtreamClient(
          { serverUrl, username, password: request.password },
          { fetch: options.fetch, userAgent: options.userAgent, listReader: options.listReader },
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
        Object.assign(live, { accountId: null, saved: null, opening: null });
        snapshot.close();
        return undefined;
      },
      /**
       * Confirms the account with the provider, so "online" means the subscription was checked (downloads, D-050).
       * Unreachable within 10 s → error (offline mode); rejected or inactive account → 401 (signed out).
       */
      async me() {
        const { stored, client } = await session();
        void ensureLibrary().catch(() => undefined);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ME_TIMEOUT_MS);
        const info = await client.validate(controller.signal).finally(() => clearTimeout(timer));
        const account: AccountDto = {
          ...stored.account,
          status: info.status,
          expiresAt: info.expiresAt,
          maxConnections: info.maxConnections,
        };
        if (credentials === stored) {
          const updated: StoredCredentials = { ...stored, account, info };
          await writeJson(options.secureStorage, CREDENTIALS_KEY, updated).catch(() => undefined);
          connect(updated);
        }
        return account;
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
        if (profiles.length >= MAX_PROFILES) throw validation(t('An account can have at most {count} profiles.', { count: MAX_PROFILES }));
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
        if (profiles.length === 1) throw validation(t('The last profile cannot be deleted.'));
        await writeJson(
          options.dataStorage,
          profilesKey(stored.account.id),
          profiles.filter((profile) => profile.id !== profileId),
        );
        await options.dataStorage.removeItem(progressKey(profileId));
        await options.dataStorage.removeItem(watchlistKey(profileId));
        return undefined;
      },
    },

    progress: {
      async list(profileId: string, limit?: number) {
        await ownedProfile(profileId);
        let items = (await readJson<ProgressDto[]>(options.dataStorage, progressKey(profileId))) ?? [];
        // A renamed title gets a new id: its progress follows it by the movie or series item (issue #216).
        const moved = await reattach(
          `progress|${profileId}`,
          items,
          (item) => (item.kind === 'movie' ? 'movies' : 'series'),
          (item) => ({ entry: item, streamIds: [item.kind === 'movie' ? item.itemId : item.seriesId].filter((id): id is string => !!id) }),
          (item, masterId) => ({ ...item, masterId }),
        ).catch((error: unknown) => {
          appLog.warn('library', `progress: renamed titles not checked: ${errorMessage(error)}`);
          return null;
        });
        if (moved) {
          // Saved unless a newer save came in meanwhile.
          const current = (await readJson<ProgressDto[]>(options.dataStorage, progressKey(profileId))) ?? [];
          if (current.length === items.length && current.every((item, index) => item.updatedAt === items[index]!.updatedAt)) {
            await writeJson(options.dataStorage, progressKey(profileId), moved);
            items = moved;
          }
        }
        return items.sort((a, b) => ordinal(b.updatedAt, a.updatedAt)).slice(0, clamp(limit ?? 50, 1, 1000));
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

    watchlist: {
      async list(profileId: string) {
        await ownedProfile(profileId);
        let items = (await readJson<WatchlistDto[]>(options.dataStorage, watchlistKey(profileId))) ?? [];
        // Each entry keeps its title's provider items; a renamed title (new id) is found again by them (issue #216).
        const moved = await reattach(
          `watchlist|${profileId}`,
          items,
          (item) => item.section,
          (item, found) => {
            const now = found.get(item.masterId);
            const same = now && item.streamIds?.length === now.length && now.every((id) => item.streamIds!.includes(id));
            return { entry: now && !same ? { ...item, streamIds: now } : item, streamIds: item.streamIds ?? [] };
          },
          (item, masterId) => ({ ...item, masterId }),
        ).catch((error: unknown) => {
          appLog.warn('library', `My List: renamed titles not checked: ${errorMessage(error)}`);
          return null;
        });
        if (moved) {
          // Two entries that are one title now: the newest stays.
          const seen = new Set<string>();
          const unique = moved
            .sort((a, b) => ordinal(b.addedAt, a.addedAt))
            .filter((item) => {
              const key = `${item.section}:${item.masterId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          const current = (await readJson<WatchlistDto[]>(options.dataStorage, watchlistKey(profileId))) ?? [];
          if (current.length === items.length && current.every((item, index) => item.masterId === items[index]!.masterId)) {
            await writeJson(options.dataStorage, watchlistKey(profileId), unique);
            items = unique;
          }
        }
        return items.sort((a, b) => ordinal(b.addedAt, a.addedAt));
      },
      async add(profileId: string, section: LibrarySection, masterId: string, request: WatchlistRequest) {
        await ownedProfile(profileId);
        const items = (await readJson<WatchlistDto[]>(options.dataStorage, watchlistKey(profileId))) ?? [];
        const existing = items.find((item) => item.section === section && item.masterId === masterId);
        if (!existing && items.length >= MAX_WATCHLIST)
          throw validation(t('My List holds at most {count} titles.', { count: MAX_WATCHLIST }));
        // Its provider items, to find it again if a rename changes its id (issue #216).
        const found = await titleLookup(section).catch(() => null);
        const streamIds = (await found?.lookup.itemsOf([masterId]).catch(() => null))?.get(masterId);
        const saved: WatchlistDto = {
          section,
          masterId,
          title: request.title.trim(),
          year: request.year ?? null,
          posterUrl: request.posterUrl ?? null,
          addedAt: existing?.addedAt ?? now().toISOString(),
          ...(streamIds?.length ? { streamIds } : existing?.streamIds ? { streamIds: existing.streamIds } : {}),
        };
        const others = items.filter((item) => item !== existing);
        await writeJson(options.dataStorage, watchlistKey(profileId), [saved, ...others]);
        return saved;
      },
      async remove(profileId: string, section: LibrarySection, masterId: string) {
        await ownedProfile(profileId);
        const items = (await readJson<WatchlistDto[]>(options.dataStorage, watchlistKey(profileId))) ?? [];
        await writeJson(
          options.dataStorage,
          watchlistKey(profileId),
          items.filter((item) => !(item.section === section && item.masterId === masterId)),
        );
        return undefined;
      },
      async noteLowSources(profileId: string, marks: WatchlistLowSource[]) {
        await ownedProfile(profileId);
        const items = (await readJson<WatchlistDto[]>(options.dataStorage, watchlistKey(profileId))) ?? [];
        const markOf = new Map(marks.map((mark) => [`${mark.section}:${mark.masterId}`, mark.lowSource]));
        let changed = false;
        const next = items.map((item) => {
          const key = `${item.section}:${item.masterId}`;
          if (!markOf.has(key)) return item;
          const lowSource = markOf.get(key);
          if ((item.lowSourceSeen ?? null) === lowSource) return item;
          changed = true;
          const { lowSourceSeen: _, ...rest } = item;
          return lowSource ? { ...rest, lowSourceSeen: lowSource } : rest;
        });
        if (changed) await writeJson(options.dataStorage, watchlistKey(profileId), next);
        return undefined;
      },
    },

    catalog: {
      async categories(section: CatalogSection, signal?: AbortSignal) {
        const { stored, client } = await session();
        return cached(`categories:${stored.account.id}:${section}`, CATALOG_CACHE_MS, () =>
          persisted(stored.account.id, `categories:${section}`, SAVED_CATEGORIES_MS, () => client.categories(catalogKind[section], signal)),
        );
      },
      liveChannels,
      searchProgrammes,
      async movies(categoryId?: string | null, signal?: AbortSignal) {
        const { stored, client } = await session();
        return cached(`movies:${stored.account.id}:${categoryId ?? ''}`, CATALOG_CACHE_MS, () => client.movies(categoryId, signal));
      },
      async movie(movieId: string, signal?: AbortSignal) {
        const { stored, client } = await session();
        return orNotFound(
          await cached(`movie:${stored.account.id}:${movieId}`, CATALOG_CACHE_MS, () =>
            persisted(stored.account.id, `movie:${movieId}`, SAVED_MOVIE_MS, () => client.movie(movieId, signal)),
          ),
        );
      },
      async series(categoryId?: string | null, signal?: AbortSignal) {
        const { stored, client } = await session();
        return cached(`series:${stored.account.id}:${categoryId ?? ''}`, CATALOG_CACHE_MS, () => client.series(categoryId, signal));
      },
      async seriesDetails(seriesId: string, signal?: AbortSignal) {
        const { stored, client } = await session();
        return orNotFound(
          await cached(`series-details:${stored.account.id}:${seriesId}`, CATALOG_CACHE_MS, () =>
            persisted(stored.account.id, `series:${seriesId}`, SAVED_SERIES_MS, () => client.seriesDetails(seriesId, signal)),
          ),
        );
      },
    },

    library: {
      async sync() {
        await session();
        void syncLibrary().catch(() => undefined);
        // Answer once the update shows as "processing": answering before, the status still read "done" and the app
        // stopped watching, so the first "Refresh library" seemed to do nothing (D-119).
        await library.started;
        return undefined;
      },
      async status() {
        const data = await ensureLibrary();
        return (['movie', 'series'] as const).map((kind) => ({
          mediaKind: kind,
          ...library.status[kind],
          masterCount: count(data, kind),
        }));
      },
      async list(section: LibrarySection, query: LibraryListQuery = {}) {
        const kept = await beforeLoad((accountId) => snapshot.list(accountId, section, query));
        if (kept) return kept;
        const data = await ensureLibrary();
        if (data?.sql && sqlLibrary) {
          const saved = data.sql[librarySection(section)];
          if (!saved) return { total: 0, items: [], sorts: availableSorts([]) };
          const started = Date.now();
          const page = await sqlLibrary.list(saved, query);
          const took = Date.now() - started;
          if (took >= 300) appLog.info('library', `${section} list took ${took} ms in the database (${JSON.stringify(query)})`);
          return page;
        }
        const masters = data?.[librarySection(section)] ?? [];
        const started = Date.now();
        const sort = query.sort ?? 'added';
        const index = ordered(masters, sort, query.order ?? defaultOrder(sort));
        const search = query.search?.trim().toLowerCase();
        const allowed = query.categoryIds ? new Set(query.categoryIds) : null;
        const inCategory = query.categoryId ? (index.byCategory.get(query.categoryId) ?? []) : index.all;
        const categoriesOf = indexFor(masters).categories;
        const inAllowed = allowed
          ? inCategory.filter((master) => (categoriesOf.get(master.id) ?? []).some((id) => allowed.has(id)))
          : inCategory;
        // Hidden categories (D-110): a title goes only when every version is in one; search ignores them.
        const hidden = !search && query.hiddenCategoryIds?.length ? new Set(query.hiddenCategoryIds) : null;
        const scope = hidden ? withoutHidden(inAllowed, categoriesOf, hidden, query.hiddenCategoryIds!) : inAllowed;
        const inLanguage = inLanguages(scope, languageCodes(query.language), query.languageCategoryIds);
        const matches = search
          ? inLanguage.filter((master) => master.normalizedKey.includes(search) || master.title.toLowerCase().includes(search))
          : inLanguage;
        const offset = Math.max(0, query.offset ?? 0);
        // Slow lists freeze the UI on a TV: the Log screen shows which (D-093).
        const took = Date.now() - started;
        if (took >= 300)
          appLog.info(
            'library',
            `${section} list (${[query.categoryId && 'category', search && 'search', query.language && 'languages', allowed && 'kids', hidden && 'hidden'].filter(Boolean).join(', ') || 'all'}, ${sort}) took ${took} ms for ${masters.length} titles`,
          );
        const page = {
          total: matches.length,
          items: matches.slice(offset, offset + clamp(query.limit ?? 100, 1, 500)).map(toCard),
          sorts: availableSorts(masters),
        };
        if (data && library.data === data && credentials && !saving.has(librarySection(section))) {
          const byId = indexFor(masters).byId;
          snapshot.record(credentials.account.id, section, query, page, (id) => {
            const master = byId.get(id);
            return master ? toDetails(master) : null;
          });
        }
        return page;
      },
      async get(section: LibrarySection, masterId: string): Promise<MasterDetails> {
        const kept = await beforeLoad((accountId) => snapshot.details(accountId, section, masterId));
        if (kept) return kept;
        const data = await ensureLibrary();
        const saved = data?.sql?.[librarySection(section)];
        const master =
          data?.sql && sqlLibrary
            ? saved
              ? await sqlLibrary.get(saved, masterId)
              : null
            : indexFor(data?.[librarySection(section)] ?? []).byId.get(masterId);
        if (!master) throw notFound();
        const regrouping =
          saved && sqlLibrary && credentials
            ? await sqlLibrary.regroupedOf(credentials.account.id, librarySection(section), saved, masterId).catch(() => null)
            : null;
        return regrouping ? { ...toDetails(master), regrouping } : toDetails(master);
      },
      async regroup(section, masterId, change) {
        await session();
        const kind = librarySection(section);
        // After an update that is running: it would replace what the change groups.
        await library.running?.catch(() => undefined);
        const run = regrouping.then(async () => {
          const data = await ensureLibrary();
          const saved = data?.sql?.[kind];
          const database = sqlLibrary;
          const accountId = credentials?.account.id;
          if (!saved || !database || !accountId) throw notFound();
          const streamIds = (await database.itemsOf(saved, [masterId])).get(masterId) ?? [];
          // The title that keeps the rest of this one: found again by an item that stays in it.
          const kept = streamIds.find((streamId) => change.action !== 'split' || streamId !== change.streamId);
          const keys = await database.changeRules(accountId, kind, saved, { ...change, id: masterId });
          if (!keys.length) return masterId;
          const started = Date.now();
          saving.add(kind);
          try {
            const result = await database.regroup(accountId, kind, saved.builtAt, keys, { hashIds: options.hashIds });
            if (!result || credentials?.account.id !== accountId) return masterId;
            library.data = {
              movie: [],
              series: [],
              ...library.data,
              builtAt: library.data?.builtAt ?? saved.builtAt,
              sql: { ...library.data?.sql, [kind]: result.saved },
            };
            appLog.info(
              'library',
              `${kind}: ${change.action} by hand, ${keys.length} title keys grouped again in ${Date.now() - started} ms`,
            );
            if (!kept) return masterId;
            return (await database.holdersOf(result.saved, [kept])).get(kept) ?? masterId;
          } finally {
            saving.delete(kind);
          }
        });
        regrouping = run.catch(() => undefined);
        return run;
      },
    },

    epg: {
      grid: epgGrid,
      async description(channelId, start, signal) {
        const { stored, client } = await session();
        const programmes = await cached(`epg-all:${stored.account.id}:${channelId}`, SHORT_EPG_CACHE_MS, () =>
          client.channelEpg(channelId, signal),
        );
        const at = Date.parse(start);
        // Guides of one provider can disagree by a few seconds on a start.
        return programmes.find((programme) => Math.abs(Date.parse(programme.start) - at) < 60_000)?.description ?? null;
      },
      async refresh() {
        const { stored } = await session();
        for (const key of [...cache.keys()])
          if (key.startsWith(`epg:${stored.account.id}:`) || key.startsWith(`epg-past:${stored.account.id}:`)) cache.delete(key);
        await catalogDb?.forget(stored.account.id, 'epg:').catch(() => undefined);
        await catalogDb?.forget(stored.account.id, 'epg-past:').catch(() => undefined);
        return undefined;
      },
    },

    playback: {
      async get(kind, id, container, _signal, options) {
        const { stored, client } = await session();
        return { ...client.playbackUrl(kind, id, container, stored.info, options?.catchup), deliveryMode: 'direct' };
      },
      async connections(signal) {
        const { client } = await session();
        return client.connections(signal);
      },
    },
  };
}
