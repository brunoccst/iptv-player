import { createApiClient, type ApiClient } from './api/apiClient';
import { createHttpClient } from './api/httpClient';
import type { AppConfig } from './config/appConfig';
import { createCatalogStore, type CatalogStore } from './stores/catalogStore';
import { createLibraryStore, type LibraryStore } from './stores/libraryStore';
import { createPlayerStore, type PlayerStore } from './stores/playerStore';
import { createSessionStore, type SessionStore } from './stores/sessionStore';
import type { KeyValueStorage } from './stores/storage';

export interface AppContext {
  config: AppConfig;
  api: ApiClient;
  stores: {
    session: SessionStore;
    catalog: CatalogStore;
    library: LibraryStore;
    player: PlayerStore;
  };
}

export interface AppContextOptions {
  config: AppConfig;
  storage: KeyValueStorage;
  fetch?: typeof fetch;
}

/** Wires API client and stores together. Each app creates exactly one context at startup. */
export function createAppContext({ config, storage, fetch }: AppContextOptions): AppContext {
  let session: SessionStore | undefined;

  const http = createHttpClient({
    baseUrl: config.apiBaseUrl,
    fetch,
    getToken: () => session?.getState().token ?? null,
    onUnauthorized: () => session?.getState().handleUnauthorized(),
  });
  const api = createApiClient(http);

  session = createSessionStore({ api, storage });
  const catalog = createCatalogStore({ api });
  const library = createLibraryStore({ api });
  const player = createPlayerStore({ api });

  // Account-scoped caches must not leak into the next login.
  session.subscribe((state, previous) => {
    if (previous.account?.id && state.account?.id !== previous.account.id) {
      catalog.getState().reset();
      library.getState().reset();
      player.getState().close();
    }
  });

  return { config, api, stores: { session, catalog, library, player } };
}
