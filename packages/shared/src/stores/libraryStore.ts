import { createStore } from 'zustand/vanilla';
import type { ApiClient, LibraryListQuery } from '../api/apiClient';
import type { ApiError } from '../api/httpClient';
import type {
  LibraryPage,
  LibrarySection,
  LibrarySort,
  LibraryStatus,
  LibraryStatusProgress,
  MasterDetails,
  SortOrder,
  VariantInfo,
} from '../api/types';
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
  /** Chosen order per section for Movies/Series grids (session only). Missing = `DEFAULT_LIBRARY_SORT`. */
  sortChoices: Partial<Record<LibrarySection, LibrarySortChoice>>;

  loadPage(section: LibrarySection, query?: LibraryListQuery, options?: LoadOptions): Promise<LibraryPage | null>;
  loadDetails(section: LibrarySection, masterId: string, options?: LoadOptions): Promise<MasterDetails | null>;
  refreshStatus(): Promise<LibraryStatus[] | null>;
  /** Asks the backend to re-fetch the provider catalog and queue normalization. */
  sync(): Promise<boolean>;
  selectVariant(masterId: string, streamId: string): void;
  chooseSort(section: LibrarySection, choice: LibrarySortChoice): void;
  /** Drops cached pages/details (library re-processed). Keeps status and variant choices. */
  invalidate(): void;
  /** Clears everything (sign-out / account change). */
  reset(): void;
}

export const DEFAULT_PAGE_SIZE = 100;

export interface LibrarySortChoice {
  sort: LibrarySort;
  order: SortOrder;
}

/** The provider's newest additions first (D-049). */
export const DEFAULT_LIBRARY_SORT: LibrarySortChoice = { sort: 'added', order: 'desc' };

/**
 * Sort menu entries; show only those whose `sort` is in the page's `sorts`. A sort without data orders by title
 * (missing values tie), so the menu then shows "Name A–Z".
 */
export const LIBRARY_SORT_OPTIONS: (LibrarySortChoice & { label: string })[] = [
  { sort: 'added', order: 'desc', label: 'Recently added' },
  { sort: 'added', order: 'asc', label: 'Oldest added' },
  { sort: 'title', order: 'asc', label: 'Name A–Z' },
  { sort: 'title', order: 'desc', label: 'Name Z–A' },
  { sort: 'released', order: 'desc', label: 'Newest release' },
  { sort: 'released', order: 'asc', label: 'Oldest release' },
];

export const sortChoiceKey = (choice: LibrarySortChoice) => `${choice.sort}-${choice.order}`;

export function pageKey(section: LibrarySection, query: LibraryListQuery = {}): string {
  return [
    section,
    query.categoryId ?? '',
    query.search?.trim().toLowerCase() ?? '',
    query.offset ?? 0,
    query.limit ?? DEFAULT_PAGE_SIZE,
    query.sort ?? '',
    query.order ?? '',
  ].join('|');
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
      sortChoices: {},

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

      chooseSort: (section, choice) => set({ sortChoices: { ...get().sortChoices, [section]: choice } }),

      invalidate: () => {
        pageLoader.invalidate();
        detailsLoader.invalidate();
        set({ pages: {}, details: {} });
      },

      reset: () => {
        for (const loader of [pageLoader, detailsLoader, statusLoader]) loader.invalidate();
        set({
          pages: {},
          details: {},
          status: emptyResource(),
          selectedVariants: {},
          syncing: false,
          syncError: null,
          sortChoices: {},
        });
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

const count = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * One line per library kind for the "organizing your library" notice. Uses the direct-mode stage and count when
 * present (D-038) and plain backend job states otherwise. Empty when nothing is running.
 */
export function describeLibraryProgress(statuses: LibraryStatus[] | null): string[] {
  if (!isLibraryProcessing(statuses)) return [];
  return (statuses ?? []).map((status) => {
    const { stage, parsedCount } = status as LibraryStatusProgress;
    const label = status.mediaKind === 'series' ? 'Series' : 'Movies';
    const total = status.itemCount ?? 0;
    switch (status.jobStatus) {
      case 'pending':
        return `${label}: waiting to start…`;
      case 'processing':
        if (stage === 'downloading') return `${label}: downloading the list from your provider…`;
        // Direct mode: `parsedCount` runs to `itemCount` over all grouping steps, so a percentage reads right.
        if (stage === 'grouping' && total > 0)
          return `${label}: grouping ${count(total)} titles, ${Math.floor((100 * (parsedCount ?? 0)) / total)}%…`;
        return total > 0 ? `${label}: grouping ${count(total)} titles…` : `${label}: grouping titles…`;
      case 'failed':
        return `${label}: failed${status.error ? ` (${status.error})` : ''}`;
      default:
        return `${label}: ${count(status.masterCount)} titles ready`;
    }
  });
}
