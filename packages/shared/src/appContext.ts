import type { ApiClient } from './api/apiClient';
import type { AppConfig } from './config/appConfig';
import { createDirectApiClient } from './direct/directApiClient';
import { withKidsFilter } from './profiles/kidsFilter';
import { languageCategoryIds } from './profiles/contentLanguages';
import type { LibrarySection, MediaCategory } from './api/types';
import { createCatalogStore, type CatalogStore } from './stores/catalogStore';
import { createEpgStore, type EpgStore } from './stores/epgStore';
import { createLibraryStore, type LibraryStore } from './stores/libraryStore';
import { createPinStore, type PinStore } from './stores/pinStore';
import { createPlayerStore, type PlayerStore } from './stores/playerStore';
import { createProfilePrefsStore, profileLanguages, type ProfilePrefsStore } from './stores/profilePrefsStore';
import { playbackChoicesOf } from './playback/playbackChoices';
import { createProgressStore, type ProgressStore } from './stores/progressStore';
import { createWatchlistStore, type WatchlistStore } from './stores/watchlistStore';
import { createSessionStore, selectActiveProfile, type SessionStore } from './stores/sessionStore';
import type { KeyValueStorage } from './stores/storage';
import { createUiLanguage, type UiLanguageControl } from './i18n/uiLanguage';
import { createSubtitleService, type SubtitleService } from './subtitles/openSubtitles';

export interface AppContext {
  config: AppConfig;
  api: ApiClient;
  stores: {
    session: SessionStore;
    catalog: CatalogStore;
    epg: EpgStore;
    library: LibraryStore;
    player: PlayerStore;
    progress: ProgressStore;
    /** "My List" of the active profile (D-055). */
    watchlist: WatchlistStore;
    /** Optional parental PIN (D-054). */
    pin: PinStore;
    /** Per-profile preferences on this device, e.g. the language filter (D-063). */
    profilePrefs: ProfilePrefsStore;
  };
  /** The language of the app's own words (D-084): per profile, the device's last choice before one is open. */
  uiLanguage: UiLanguageControl;
  /** Automatic subtitles from OpenSubtitles (D-111). */
  subtitles: SubtitleService;
  /** Re-reads the saved login and profile data, e.g. after restoring a backup (D-056). */
  reload(): Promise<void>;
  /** Tests only: answer every call from `api` instead of the provider (`null` goes back). */
  replaceApi(api: ApiClient | null): void;
}

export interface AppContextOptions {
  config: AppConfig;
  storage: KeyValueStorage;
  fetch?: typeof fetch;
  /**
   * The apps talk to the IPTV provider directly (D-038, D-088): `dataStorage` keeps profiles, progress and the grouped
   * library; `userAgent` is sent to the provider.
   */
  direct: { dataStorage: KeyValueStorage; userAgent?: string };
  /** Tests: a fake instead of the provider (see `testing/fakeBackend.ts`). */
  api?: ApiClient;
  /** The device's preferred languages, for the app's language on a first start (D-084). Default: the browser's. */
  deviceLanguages?: () => readonly string[];
}

type AnyFunction = (...args: never[]) => unknown;

/** An `ApiClient` that sends every call to whatever `current()` returns at the time of the call. */
function delegatingApi(current: () => ApiClient): ApiClient {
  const wrap = (path: string[], shape: object): object =>
    Object.fromEntries(
      Object.entries(shape).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? (...args: never[]) => {
              let target: unknown = current();
              for (const segment of [...path, key]) target = (target as Record<string, unknown>)[segment];
              return (target as AnyFunction)(...args);
            }
          : wrap([...path, key], value as object),
      ]),
    );
  return wrap([], current()) as ApiClient;
}

/** Saved by versions that could go through a server ("My server", D-038); read by none since D-088. */
const RETIRED_CONNECTION_KEY = 'connection';

/** Wires API client and stores together. Each app creates exactly one context at startup. */
export function createAppContext({ config, storage, fetch, direct, api: testApi, deviceLanguages }: AppContextOptions): AppContext {
  const directApi = createDirectApiClient({
    appName: config.appName,
    secureStorage: storage,
    dataStorage: direct.dataStorage,
    fetch,
    userAgent: direct.userAgent,
  });
  let replacement: ApiClient | null = testApi ?? null;
  const providerApi = delegatingApi(() => replacement ?? directApi);
  void Promise.resolve(storage.removeItem(RETIRED_CONNECTION_KEY)).catch(() => undefined);

  // Kids profiles only see kids categories (D-053); `session` is initialized below, before any request.
  // Per-profile preferences on this device: the language filter (D-063) and a Kids profile's categories (D-064).
  const profilePrefs = createProfilePrefsStore(direct.dataStorage);
  void profilePrefs.getState().load();
  const activePrefs = () => {
    const profileId = session.getState().activeProfileId;
    return profileId ? profilePrefs.getState().prefs[profileId] : undefined;
  };
  const kids = withKidsFilter(
    providerApi,
    () => selectActiveProfile(session.getState())?.isKids === true,
    (section) => activePrefs()?.kidsCategories?.[section] ?? null,
  );
  // One or more languages (D-067), sent as a comma-separated list: `ENG,GER`.
  const activeLanguage = () => profileLanguages(activePrefs()).join(',') || null;
  // The filter's category hint (D-086): which categories let titles without a language of their own through.
  const categoryNames = new Map<LibrarySection, Promise<MediaCategory[]>>();
  const categoriesOf = (section: LibrarySection) => {
    let list = categoryNames.get(section);
    if (!list) {
      list = providerApi.catalog.categories(section);
      list.catch(() => categoryNames.delete(section));
      categoryNames.set(section, list);
    }
    return list;
  };
  const api: ApiClient = {
    ...kids.api,
    library: {
      ...kids.api.library,
      list: async (section, query = {}, signal) => {
        const language = query.language !== undefined ? query.language : activeLanguage();
        if (!language || query.languageCategoryIds) return kids.api.library.list(section, { ...query, language }, signal);
        const categories = await categoriesOf(section).catch(() => []);
        const languageCategories = languageCategoryIds(categories, language.split(','));
        return kids.api.library.list(section, { ...query, language, languageCategoryIds: languageCategories }, signal);
      },
    },
  };

  const session = createSessionStore({ api, storage });
  const catalog = createCatalogStore({ api });
  const epg = createEpgStore({ api });
  const library = createLibraryStore({ api });
  const player = createPlayerStore({ api });
  const progress = createProgressStore({ api });
  const watchlist = createWatchlistStore({ api });
  const pin = createPinStore({ session, storage });
  const uiLanguage = createUiLanguage({ storage: direct.dataStorage, session, profilePrefs, deviceLanguages });
  void uiLanguage.load();
  const subtitles = createSubtitleService({
    secureStorage: storage,
    dataStorage: direct.dataStorage,
    fetch,
    userAgent: `${config.appName} v1`,
  });
  void subtitles.settings.getState().load();

  // Another language or other Kids categories (a new choice, or another profile's) mean other titles: drop cached lists.
  const filters = () => JSON.stringify([activeLanguage(), activePrefs()?.kidsCategories ?? null]);
  let current = filters();
  const filtersChanged = () => {
    const next = filters();
    if (next === current) return;
    current = next;
    catalog.getState().reset();
    epg.getState().reset();
    library.getState().reset();
  };
  profilePrefs.subscribe(filtersChanged);
  session.subscribe(filtersChanged);

  // The open profile's version choice picks the version titles start with (D-087).
  const followVersion = () => {
    const version = playbackChoicesOf(activePrefs()).version ?? null;
    if (library.getState().preferredVersion !== version) library.getState().setPreferredVersion(version);
  };
  followVersion();
  profilePrefs.subscribe(followVersion);
  session.subscribe(followVersion);

  // Account-scoped caches must not leak into the next login.
  session.subscribe((state, previous) => {
    const accountChanged = Boolean(previous.account?.id) && state.account?.id !== previous.account?.id;
    // Switching between a Kids and a regular profile changes what may be shown: drop everything cached.
    const kidsChanged = (selectActiveProfile(state)?.isKids === true) !== (selectActiveProfile(previous)?.isKids === true);
    if (accountChanged) {
      kids.reset();
      categoryNames.clear();
    }
    if (accountChanged || kidsChanged) {
      catalog.getState().reset();
      epg.getState().reset();
      library.getState().reset();
      player.getState().close();
    }
    // Progress belongs to a profile: reload whenever the active profile changes.
    if (state.activeProfileId !== previous.activeProfileId) {
      progress.getState().reset();
      watchlist.getState().reset();
      if (state.activeProfileId) {
        void progress.getState().load(state.activeProfileId);
        void watchlist.getState().load(state.activeProfileId);
      }
    }
  });

  const reload = async () => {
    directApi.reloadCredentials();
    kids.reset();
    categoryNames.clear();
    catalog.getState().reset();
    epg.getState().reset();
    library.getState().reset();
    player.getState().close();
    progress.getState().reset();
    watchlist.getState().reset();
    await session.getState().restore();
    // restore() keeps the same profile id when nothing changed, so the subscription above may not load it.
    const profileId = session.getState().activeProfileId;
    if (profileId) {
      void progress.getState().load(profileId);
      void watchlist.getState().load(profileId);
    }
  };

  return {
    config,
    api,
    reload,
    replaceApi: (next) => {
      replacement = next;
    },
    uiLanguage,
    subtitles,
    stores: { session, catalog, epg, library, player, progress, watchlist, pin, profilePrefs },
  };
}
