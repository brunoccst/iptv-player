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
import { createPlayerStore, type PlayerStore } from './stores/playerStore';
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
    /** Present when direct mode is enabled (native apps). */
    connection?: ConnectionStore;
  };
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
  const providerApi =
    direct && connection
      ? createHybridApiClient({
          server: serverApi,
          connection,
          direct: createDirectApiClient({
            appName: config.appName,
            secureStorage: storage,
            dataStorage: direct.dataStorage,
            fetch,
            userAgent: direct.userAgent,
          }),
        })
      : serverApi;

  // Kids profiles only see kids categories (D-053); `session` is initialized below, before any request.
  const kids = withKidsFilter(providerApi, () => selectActiveProfile(session.getState())?.isKids === true);
  const api = kids.api;

  const session = createSessionStore({ api, storage });
  const catalog = createCatalogStore({ api });
  const epg = createEpgStore({ api });
  const library = createLibraryStore({ api });
  const player = createPlayerStore({ api });
  const progress = createProgressStore({ api });
  const watchlist = createWatchlistStore({ api });

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

  return { config, api, stores: { session, catalog, epg, library, player, progress, watchlist, connection } };
}
