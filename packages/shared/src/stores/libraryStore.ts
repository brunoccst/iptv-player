import { createStore } from 'zustand/vanilla';
import type { ApiClient, LibraryListQuery } from '../api/apiClient';
import type { ApiError } from '../api/httpClient';
import type { LibraryPage, LibrarySection, LibraryStatus, MasterDetails, VariantInfo } from '../api/types';
import { createResourceLoader, emptyResource, toApiError, type LoadOptions, type Resource } from './resource';

/** Deduplicated library (master cards + variants) and the user's "Version / Stream Quality" choices. */
export interface LibraryState {
  pages: Record<string, Resource<LibraryPage>>;
  details: Record<string, Resource<MasterDetails>>;
  status: Resource<LibraryStatus[]>;
  /** masterId → chosen variant streamId. Missing = best variant. */
  selectedVariants: Record<string, string>;
  syncing: boolean;
  syncError: ApiError | null;

  loadPage(section: LibrarySection, query?: LibraryListQuery, options?: LoadOptions): Promise<LibraryPage | null>;
  loadDetails(section: LibrarySection, masterId: string, options?: LoadOptions): Promise<MasterDetails | null>;
  refreshStatus(): Promise<LibraryStatus[] | null>;
  /** Asks the backend to re-fetch the provider catalog and queue normalization. */
  sync(): Promise<boolean>;
  selectVariant(masterId: string, streamId: string): void;
  /** Drops cached pages/details (library re-processed). Keeps status and variant choices. */
  invalidate(): void;
  /** Clears everything (sign-out / account change). */
  reset(): void;
}

export const DEFAULT_PAGE_SIZE = 100;

export function pageKey(section: LibrarySection, query: LibraryListQuery = {}): string {
  return [section, query.categoryId ?? '', query.search?.trim().toLowerCase() ?? '', query.offset ?? 0, query.limit ?? DEFAULT_PAGE_SIZE]
    .join('|');
}

export const detailsKey = (section: LibrarySection, masterId: string) => `${section}|${masterId}`;

export function createLibraryStore({ api }: { api: ApiClient }) {
  return createStore<LibraryState>()((set, get) => {
    const pageLoader = createResourceLoader<LibraryPage>(
      () => get().pages,
      (key, resource) => set({ pages: { ...get().pages, [key]: resource } }),
    );
    const detailsLoader = createResourceLoader<MasterDetails>(
      () => get().details,
      (key, resource) => set({ details: { ...get().details, [key]: resource } }),
    );
    const statusLoader = createResourceLoader<LibraryStatus[]>(
      () => ({ status: get().status }),
      (_, resource) => set({ status: resource }),
    );

    return {
      pages: {},
      details: {},
      status: emptyResource(),
      selectedVariants: {},
      syncing: false,
      syncError: null,

      loadPage: (section, query = {}, options) =>
        pageLoader.load(pageKey(section, query), () => api.library.list(section, { limit: DEFAULT_PAGE_SIZE, ...query }), options),

      loadDetails: (section, masterId, options) =>
        detailsLoader.load(detailsKey(section, masterId), () => api.library.get(section, masterId), options),

      refreshStatus: () => statusLoader.load('status', () => api.library.status(), { force: true }),

      async sync() {
        set({ syncing: true, syncError: null });
        try {
          await api.library.sync();
          set({ syncing: false });
          return true;
        } catch (error) {
          set({ syncing: false, syncError: toApiError(error) });
          return false;
        }
      },

      selectVariant: (masterId, streamId) => set({ selectedVariants: { ...get().selectedVariants, [masterId]: streamId } }),

      invalidate: () => {
        pageLoader.invalidate();
        detailsLoader.invalidate();
        set({ pages: {}, details: {} });
      },

      reset: () => {
        for (const loader of [pageLoader, detailsLoader, statusLoader]) loader.invalidate();
        set({ pages: {}, details: {}, status: emptyResource(), selectedVariants: {}, syncing: false, syncError: null });
      },
    };
  });
}

export type LibraryStore = ReturnType<typeof createLibraryStore>;

/** The chosen variant, falling back to the best one (backend orders variants best-first). */
export function selectVariant(state: Pick<LibraryState, 'selectedVariants'>, details: MasterDetails): VariantInfo | null {
  const chosen = state.selectedVariants[details.id];
  return details.variants.find((variant) => variant.streamId === chosen) ?? details.variants[0] ?? null;
}

/** True while any library kind still has a queued or running normalization job. */
export function isLibraryProcessing(statuses: LibraryStatus[] | null): boolean {
  return (statuses ?? []).some((status) => status.jobStatus === 'pending' || status.jobStatus === 'processing');
}
