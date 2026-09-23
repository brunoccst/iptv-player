import { createApiClient, type ApiClient } from './api/apiClient';
import { createHttpClient } from './api/httpClient';
import type { AppConfig } from './config/appConfig';
import { createCatalogStore, type CatalogStore } from './stores/catalogStore';
import { createEpgStore, type EpgStore } from './stores/epgStore';
import { createLibraryStore, type LibraryStore } from './stores/libraryStore';
import { createPlayerStore, type PlayerStore } from './stores/playerStore';
import { createProgressStore, type ProgressStore } from './stores/progressStore';
import { createSessionStore, type SessionStore } from './stores/sessionStore';
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
  };
}

export interface AppContextOptions {
  config: AppConfig;
  storage: KeyValueStorage;
  fetch?: typeof fetch;
}

/** Wires API client and stores together. Each app creates exactly one context at startup. */
export function createAppContext({ config, storage, fetch }: AppContextOptions): AppContext {
  const http = createHttpClient({
    baseUrl: config.apiBaseUrl,
    fetch,
    // Called per request, after `session` below is initialized.
    getToken: () => session.getState().token ?? null,
    onUnauthorized: () => session.getState().handleUnauthorized(),
  });
  const api = createApiClient(http);

  const session = createSessionStore({ api, storage });
  const catalog = createCatalogStore({ api });
  const epg = createEpgStore({ api });
  const library = createLibraryStore({ api });
  const player = createPlayerStore({ api });
  const progress = createProgressStore({ api });

  // Account-scoped caches must not leak into the next login.
  session.subscribe((state, previous) => {
    if (previous.account?.id && state.account?.id !== previous.account.id) {
      catalog.getState().reset();
      epg.getState().reset();
      library.getState().reset();
      player.getState().close();
    }
    // Progress belongs to a profile: reload whenever the active profile changes.
    if (state.activeProfileId !== previous.activeProfileId) {
      progress.getState().reset();
      if (state.activeProfileId) void progress.getState().load(state.activeProfileId);
    }
  });

  return { config, api, stores: { session, catalog, epg, library, player, progress } };
}
