import { createApiClient, type ApiClient } from './api/apiClient';
import { createHttpClient } from './api/httpClient';
import type { AppConfig } from './config/appConfig';
import { createDirectApiClient } from './direct/directApiClient';
import { createHybridApiClient } from './direct/hybridApiClient';
import { withKidsFilter } from './profiles/kidsFilter';
import { createCatalogStore, type CatalogStore } from './stores/catalogStore';
import { createConnectionStore, type ConnectionStore } from './stores/connectionStore';
import { createEpgStore, type EpgStore } from './stores/epgStore';
import { createLibraryStore, type LibraryStore } from './stores/libraryStore';
import { createPinStore, type PinStore } from './stores/pinStore';
import { createPlayerStore, type PlayerStore } from './stores/playerStore';
import { createProfilePrefsStore, profileLanguages, type ProfilePrefsStore } from './stores/profilePrefsStore';
import { createProgressStore, type ProgressStore } from './stores/progressStore';
import { createWatchlistStore, type WatchlistStore } from './stores/watchlistStore';
import { createSessionStore, selectActiveProfile, type SessionStore } from './stores/sessionStore';
import type { KeyValueStorage } from './stores/storage';

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
    /** Present when direct mode is enabled (native apps). */
    connection?: ConnectionStore;
    /** Per-profile preferences on this device, e.g. the language filter (D-063). */
    profilePrefs: ProfilePrefsStore;
  };
  /** Re-reads the saved login, connection and profile data, e.g. after restoring a backup (D-056). */
  reload(): Promise<void>;
}

export interface AppContextOptions {
  config: AppConfig;
  storage: KeyValueStorage;
  fetch?: typeof fetch;
  /** Native apps: talk to the provider directly unless the user picks "My server". See DECISIONS.md#d-038. */
  direct?: { dataStorage: KeyValueStorage; userAgent?: string };
}

/** Wires API client and stores together. Each app creates exactly one context at startup. */
export function createAppContext({ config, storage, fetch, direct }: AppContextOptions): AppContext {
  const connection = direct ? createConnectionStore({ storage, defaultServerUrl: config.apiBaseUrl }) : undefined;
  const http = createHttpClient({
    baseUrl: connection ? () => connection.getState().serverUrl : config.apiBaseUrl,
    fetch,
    // Called per request, after `session` below is initialized.
    getToken: () => session.getState().token ?? null,
    onUnauthorized: () => session.getState().handleUnauthorized(),
  });
  const serverApi = createApiClient(http);
  const directApi = direct
    ? createDirectApiClient({
        appName: config.appName,
        secureStorage: storage,
        dataStorage: direct.dataStorage,
        fetch,
        userAgent: direct.userAgent,
      })
    : undefined;
  const providerApi = directApi && connection ? createHybridApiClient({ server: serverApi, connection, direct: directApi }) : serverApi;

  // Kids profiles only see kids categories (D-053); `session` is initialized below, before any request.
  // Per-profile preferences on this device: the language filter (D-063) and a Kids profile's categories (D-064).
  const profilePrefs = createProfilePrefsStore(direct?.dataStorage ?? storage);
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
  const api: ApiClient = {
    ...kids.api,
    library: {
      ...kids.api.library,
      list: (section, query = {}, signal) => kids.api.library.list(section, { language: activeLanguage(), ...query }, signal),
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

  // Account-scoped caches must not leak into the next login.
  session.subscribe((state, previous) => {
    const accountChanged = Boolean(previous.account?.id) && state.account?.id !== previous.account?.id;
    // Switching between a Kids and a regular profile changes what may be shown: drop everything cached.
    const kidsChanged = (selectActiveProfile(state)?.isKids === true) !== (selectActiveProfile(previous)?.isKids === true);
    if (accountChanged) kids.reset();
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
    await connection?.getState().reload();
    directApi?.reloadCredentials();
    kids.reset();
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

  return { config, api, reload, stores: { session, catalog, epg, library, player, progress, watchlist, pin, connection, profilePrefs } };
}
