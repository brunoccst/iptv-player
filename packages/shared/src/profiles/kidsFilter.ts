import type { ApiClient } from '../api/apiClient';
import type { CatalogSection } from '../api/types';

/**
 * Kids profiles (D-053): providers send no age ratings, so a category counts as "for kids" when its name says so
 * (several languages) and nothing in it suggests adult content. Everything else is hidden from Kids profiles.
 */
const KIDS =
  /(?:^|[^\p{L}])(kids?|kinder|child(?:ren)?|cartoons?|toons?|animation|animated|family|familie|disney|pixar|dreamworks|nick(?:elodeon)?|kika|junior|baby|infantil|niñ[oa]s|enfants?|bambini|zeichentrick|dessins? anim)/iu;
const ADULT = /(adult|xxx|porn|erotic|erotik|\bsex|18\s*\+|\+\s*18|for adults|nur für erwachsene)/iu;

export const isKidsCategory = (name: string) => KIDS.test(name) && !ADULT.test(name);

/** No provider category id looks like this; asking for it returns nothing (an empty list would mean "no filter"). */
const NOTHING = '__kids-none__';

/**
 * Wraps an API client so that, while `isKids()` is true, categories, live channels, the guide, library lists (and
 * search) and raw movie/series lists only contain kids categories. `reset()` forgets cached category ids (account change).
 */
export function withKidsFilter(api: ApiClient, isKids: () => boolean) {
  const cache = new Map<CatalogSection, Promise<string[]>>();
  const allowedIds = (section: CatalogSection) => {
    let ids = cache.get(section);
    if (!ids) {
      ids = api.catalog.categories(section).then((list) => list.filter((c) => isKidsCategory(c.name)).map((c) => c.id));
      ids.catch(() => cache.delete(section));
      cache.set(section, ids);
    }
    return ids;
  };
  const allowedSet = async (section: CatalogSection) => new Set(await allowedIds(section));
  const filterIds = async (section: CatalogSection) => {
    const ids = await allowedIds(section);
    return ids.length > 0 ? ids : [NOTHING];
  };
  const inAllowed = <T extends { categoryId: string | null }>(items: T[], allowed: Set<string>) =>
    items.filter((item) => item.categoryId !== null && allowed.has(item.categoryId));

  const filtered: ApiClient = {
    ...api,
    catalog: {
      ...api.catalog,
      categories: async (section, signal) => {
        const list = await api.catalog.categories(section, signal);
        return isKids() ? list.filter((c) => isKidsCategory(c.name)) : list;
      },
      liveChannels: async (categoryId, signal) => {
        const list = await api.catalog.liveChannels(categoryId, signal);
        return isKids() ? inAllowed(list, await allowedSet('live')) : list;
      },
      movies: async (categoryId, signal) => {
        const list = await api.catalog.movies(categoryId, signal);
        return isKids() ? inAllowed(list, await allowedSet('movies')) : list;
      },
      series: async (categoryId, signal) => {
        const list = await api.catalog.series(categoryId, signal);
        return isKids() ? inAllowed(list, await allowedSet('series')) : list;
      },
    },
    library: {
      ...api.library,
      list: async (section, query = {}, signal) =>
        isKids()
          ? api.library.list(section, { ...query, categoryIds: await filterIds(section) }, signal)
          : api.library.list(section, query, signal),
    },
    epg: {
      ...api.epg,
      grid: async (query = {}, signal) =>
        isKids() ? api.epg.grid({ ...query, categoryIds: await filterIds('live') }, signal) : api.epg.grid(query, signal),
    },
  };
  return { api: filtered, reset: () => cache.clear() };
}
