import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { CatalogSection, LiveChannel, MediaCategory } from '../api/types';
import { createResourceLoader, type LoadOptions, type Resource } from './resource';

/** Raw provider catalog: categories for all sections and live channels. VOD/series lists come from the library store. */
export interface CatalogState {
  categories: Record<string, Resource<MediaCategory[]>>;
  liveChannels: Record<string, Resource<LiveChannel[]>>;
  loadCategories(section: CatalogSection, options?: LoadOptions): Promise<MediaCategory[] | null>;
  /** `categoryId` null loads every channel. */
  loadLiveChannels(categoryId: string | null, options?: LoadOptions): Promise<LiveChannel[] | null>;
  reset(): void;
}

export const ALL_CATEGORIES_KEY = '*';

export function createCatalogStore({ api }: { api: ApiClient }) {
  return createStore<CatalogState>()((set, get) => {
    const categoryLoader = createResourceLoader<MediaCategory[]>(
      () => get().categories,
      (key, resource) => set({ categories: { ...get().categories, [key]: resource } }),
    );
    const channelLoader = createResourceLoader<LiveChannel[]>(
      () => get().liveChannels,
      (key, resource) => set({ liveChannels: { ...get().liveChannels, [key]: resource } }),
    );

    return {
      categories: {},
      liveChannels: {},
      loadCategories: (section, options) => categoryLoader.load(section, () => api.catalog.categories(section), options),
      loadLiveChannels: (categoryId, options) =>
        channelLoader.load(categoryId ?? ALL_CATEGORIES_KEY, () => api.catalog.liveChannels(categoryId), options),
      reset: () => {
        categoryLoader.invalidate();
        channelLoader.invalidate();
        set({ categories: {}, liveChannels: {} });
      },
    };
  });
}

export type CatalogStore = ReturnType<typeof createCatalogStore>;
