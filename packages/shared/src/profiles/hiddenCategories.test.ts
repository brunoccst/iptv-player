import { describe, expect, it } from 'vitest';
import type { ApiClient, EpgGridQuery, LibraryListQuery } from '../api/apiClient';
import { withHiddenCategories } from './hiddenCategories';

describe('hidden categories (D-110)', () => {
  const lists: LibraryListQuery[] = [];
  const grids: EpgGridQuery[] = [];
  const base = {
    catalog: {
      categories: async () => [
        { id: '1', name: 'Movies' },
        { id: '2', name: 'VOD | HUGE LIST' },
      ],
      liveChannels: async () => [
        { id: 'a', name: 'News', categoryId: '5' },
        { id: 'b', name: 'Shopping 1', categoryId: '6' },
        { id: 'c', name: 'No group', categoryId: null },
      ],
    },
    library: {
      list: async (_section: string, query: LibraryListQuery = {}) => {
        lists.push(query);
        return { total: 0, items: [], sorts: [] };
      },
    },
    epg: {
      grid: async (query: EpgGridQuery = {}) => {
        grids.push(query);
        return {};
      },
    },
  } as unknown as ApiClient;
  const hidden: Record<string, string[]> = { movies: ['2'], live: ['6'], series: [] };
  const api = withHiddenCategories(base, (section) => hidden[section] ?? []);

  it('leaves hidden categories and their channels out of browsing', async () => {
    expect((await api.catalog.categories('movies')).map((c) => c.id)).toEqual(['1']);
    expect((await api.catalog.categories('series')).map((c) => c.id)).toEqual(['1', '2']);
    expect((await api.catalog.liveChannels(null)).map((c) => c.id)).toEqual(['a', 'c']);
    await api.library.list('movies', { sort: 'added' });
    expect(lists.at(-1)).toEqual({ sort: 'added', hiddenCategoryIds: ['2'] });
    await api.library.list('series');
    expect(lists.at(-1)).toEqual({ hiddenCategoryIds: null });
    await api.epg.grid({ offset: 0 });
    expect(grids.at(-1)).toEqual({ offset: 0, hiddenCategoryIds: ['6'] });
  });

  it('search and the settings still see everything', async () => {
    await api.library.list('movies', { search: 'huge' });
    expect(lists.at(-1)).toEqual({ search: 'huge' });
    expect((await api.catalog.liveChannels(null, undefined, { includeHidden: true })).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect((await api.catalog.categories('movies', undefined, { includeHidden: true })).map((c) => c.id)).toEqual(['1', '2']);
  });
});
