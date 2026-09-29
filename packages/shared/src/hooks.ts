import { useEffect, useState } from 'react';
import { ApiError } from './api/errors';
import type { LibrarySection, MasterCard } from './api/types';
import type { AppContext } from './appContext';
import { offlineAccess } from './playback/offlineAccess';
import { useAppStore } from './react';
import type { CatalogState } from './stores/catalogStore';
import { pageKey, type LibrarySortChoice, type LibraryState } from './stores/libraryStore';
import type { PinState } from './stores/pinStore';
import type { ProfilePrefsState } from './stores/profilePrefsStore';
import type { ProgressState } from './stores/progressStore';
import type { SessionState } from './stores/sessionStore';
import type { WatchlistState } from './stores/watchlistStore';

/**
 * Hooks the TV/phone app and the desktop/web app share (D-124): the same state, loading and paging for both; each app
 * only draws. Made once per app from its stores: `export const { useSession, usePagedLibrary } = createAppHooks(stores)`.
 */
export function createAppHooks(stores: AppContext['stores']) {
  const useSession = <T>(selector: (state: SessionState) => T) => useAppStore(stores.session, selector);
  const useLibrary = <T>(selector: (state: LibraryState) => T) => useAppStore(stores.library, selector);

  return {
    useSession,
    useCatalog: <T>(selector: (state: CatalogState) => T) => useAppStore(stores.catalog, selector),
    useLibrary,
    useProgress: <T>(selector: (state: ProgressState) => T) => useAppStore(stores.progress, selector),
    useWatchlist: <T>(selector: (state: WatchlistState) => T) => useAppStore(stores.watchlist, selector),
    useProfilePrefs: <T>(selector: (state: ProfilePrefsState) => T) => useAppStore(stores.profilePrefs, selector),
    usePin: <T>(selector: (state: PinState) => T) => useAppStore(stores.pin, selector),

    /** Whether downloads may play (subscription active, online within 30 days). D-050. */
    useOfflineAccess() {
      const expiresAt = useSession((s) => s.account?.expiresAt ?? null);
      const lastOnlineAt = useSession((s) => s.lastOnlineAt);
      return offlineAccess({ expiresAt }, lastOnlineAt);
    },

    /**
     * Library titles loaded page by page: `loadMore()` fetches the next page (rows and grids call it near their end).
     * Nothing loads until `enabled` (rows that wait until they are on screen). Without `sort` the default order applies
     * (D-049). A new filter starts again from the first page.
     */
    usePagedLibrary(
      section: LibrarySection,
      filter: { categoryId?: string | null; search?: string | null; sort?: LibrarySortChoice | null },
      pageSize: number,
      enabled = true,
    ) {
      const categoryId = filter.categoryId ?? null;
      const search = filter.search || null;
      const sort = filter.sort?.sort;
      const order = filter.sort?.order;
      const [pages, setPages] = useState(1);
      const query = (page: number) => ({ categoryId, search, limit: pageSize, offset: page * pageSize, sort, order });
      const resources = useLibrary((s) => Array.from({ length: pages }, (_, page) => s.pages[pageKey(section, query(page))]));

      useEffect(() => setPages(1), [section, categoryId, search, sort, order]);
      useEffect(() => {
        if (enabled) void stores.library.getState().loadPage(section, query(pages - 1));
        // query is derived from section, category, search, sort and the page size.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [section, categoryId, search, sort, order, pages, enabled]);

      const items: MasterCard[] = resources.flatMap((resource) => resource?.data?.items ?? []);
      const total = resources[0]?.data?.total ?? 0;
      const last = resources[resources.length - 1];
      // Not asked yet counts as loading: a spinner until the first answer, not an empty list.
      const loading = !last || last.status === 'loading' || last.status === 'idle';
      return {
        items,
        total,
        /** Orders the library has data for (from the first page); null until it loads. */
        sorts: resources[0]?.data?.sorts ?? null,
        /** First page not in yet. */
        loadingFirst: pages === 1 && loading,
        loadingMore: pages > 1 && loading,
        done: resources[0]?.status === 'success' && items.length >= total,
        error: last?.status === 'error' ? last.error : null,
        hasMore: items.length < total,
        loadMore: () => {
          if (!loading && items.length < total) setPages((count) => count + 1);
        },
      };
    },
  };
}

export type AppHooks = ReturnType<typeof createAppHooks>;

const asyncCache = new Map<string, unknown>();

export interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/** Loads `key` once per app session (module cache). `key` null = idle. For ad-hoc reads outside the shared stores. */
export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncResult<T> {
  const [state, setState] = useState<AsyncResult<T>>(() =>
    key && asyncCache.has(key)
      ? { data: asyncCache.get(key) as T, loading: false, error: null }
      : { data: null, loading: !!key, error: null },
  );

  useEffect(() => {
    if (!key) return setState({ data: null, loading: false, error: null });
    if (asyncCache.has(key)) return setState({ data: asyncCache.get(key) as T, loading: false, error: null });
    let active = true;
    setState({ data: null, loading: true, error: null });
    load().then(
      (data) => {
        asyncCache.set(key, data);
        if (active) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (active)
          setState({ data: null, loading: false, error: error instanceof ApiError ? error : new ApiError(0, 'http_error', String(error)) });
      },
    );
    return () => {
      active = false;
    };
    // `load` is expected to change with `key`; keying on it alone avoids refetch loops from inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
