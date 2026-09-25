import { useEffect, useState } from 'react';
import { pageKey, type LibrarySection, type LibrarySortChoice, type MasterCard } from '@iptv/shared';
import { stores } from '../appContext';
import { useLibrary } from './stores';

/**
 * Library titles loaded page by page: `loadMore()` fetches the next page (rows and grids call it near their end).
 * Nothing loads until `enabled` (rows wait until they scroll into view). Without `sort` the backend default applies.
 */
export function usePagedLibrary(
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

  useEffect(() => {
    if (enabled) void stores.library.getState().loadPage(section, query(pages - 1));
    // query is derived from section, category, search, sort and the page size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, categoryId, search, sort, order, pages, enabled]);

  const items: MasterCard[] = resources.flatMap((resource) => resource?.data?.items ?? []);
  const total = resources[0]?.data?.total ?? 0;
  const last = resources[resources.length - 1];
  const loading = last?.status === 'loading';
  return {
    items,
    total,
    /** Orders the library has data for (from the first page); null until it loads. */
    sorts: resources[0]?.data?.sorts ?? null,
    loadingFirst: pages === 1 && (loading || !last),
    loadingMore: pages > 1 && loading,
    done: resources[0]?.status === 'success' && items.length >= total,
    error: last?.status === 'error' ? last.error : null,
    hasMore: items.length < total,
    loadMore: () => {
      if (!loading && items.length < total) setPages((count) => count + 1);
    },
  };
}
