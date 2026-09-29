import type { ApiClient } from '../api/apiClient';
import type { CatalogSection } from '../api/types';

/**
 * Categories a profile hid from browsing (D-110). Wraps an API client so that, while `hidden(section)` names some,
 * category lists, live channel lists, the guide and library lists leave them out. Searches (a library list with
 * `search`, channels asked for with `includeHidden`) and the settings (`includeHidden`) still see everything. A title
 * with a version in a category that is not hidden stays.
 */
export function withHiddenCategories(api: ApiClient, hidden: (section: CatalogSection) => string[]): ApiClient {
  const hiddenIds = (section: CatalogSection) => {
    const ids = hidden(section);
    return ids.length > 0 ? ids : null;
  };
  return {
    ...api,
    catalog: {
      ...api.catalog,
      categories: async (section, signal, options) => {
        const list = await api.catalog.categories(section, signal, options);
        const ids = options?.includeHidden ? null : hiddenIds(section);
        return ids ? list.filter((category) => !ids.includes(category.id)) : list;
      },
      liveChannels: async (categoryId, signal, options) => {
        const list = await api.catalog.liveChannels(categoryId, signal, options);
        const ids = options?.includeHidden ? null : hiddenIds('live');
        if (!ids) return list;
        const set = new Set(ids);
        return list.filter((channel) => channel.categoryId === null || !set.has(channel.categoryId));
      },
    },
    library: {
      ...api.library,
      list: (section, query = {}, signal) =>
        query.search?.trim() || query.hiddenCategoryIds
          ? api.library.list(section, query, signal)
          : api.library.list(section, { ...query, hiddenCategoryIds: hiddenIds(section) }, signal),
    },
    epg: {
      ...api.epg,
      grid: (query = {}, signal) => api.epg.grid({ ...query, hiddenCategoryIds: query.hiddenCategoryIds ?? hiddenIds('live') }, signal),
    },
  };
}
