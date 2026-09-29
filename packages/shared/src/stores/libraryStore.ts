import { createStore } from 'zustand/vanilla';
import type { ApiClient, LibraryListQuery } from '../api/apiClient';
import type { ApiError } from '../api/errors';
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
import { t } from '../i18n/i18n';
import { preferredVariant, type VersionChoice } from '../playback/playbackChoices';

/** Deduplicated library (master cards + variants) and the user's "Version / Stream Quality" choices. */
export interface LibraryState {
  pages: Record<string, Resource<LibraryPage>>;
  details: Record<string, Resource<MasterDetails>>;
  status: Resource<LibraryStatus[]>;
  /** masterId → chosen variant streamId. Missing = the preferred version, else the best variant. */
  selectedVariants: Record<string, string>;
  /** The open profile's version choice (D-087): language and quality titles start with when none was picked. */
  preferredVersion: VersionChoice | null;
  syncing: boolean;
  syncError: ApiError | null;
  /**
   * After a refresh the user asked for (`sync`) has finished: what it did ("Your library is up to date…", or what
   * changed), until `dismissRefreshNotice` (D-119).
   */
  refreshNotice: string | null;
  /** Chosen order per section for Movies/Series grids (session only). Missing = `DEFAULT_LIBRARY_SORT`. */
  sortChoices: Partial<Record<LibrarySection, LibrarySortChoice>>;

  loadPage(section: LibrarySection, query?: LibraryListQuery, options?: LoadOptions): Promise<LibraryPage | null>;
  loadDetails(section: LibrarySection, masterId: string, options?: LoadOptions): Promise<MasterDetails | null>;
  refreshStatus(): Promise<LibraryStatus[] | null>;
  /** Reads the provider's catalog again and regroups it. */
  sync(): Promise<boolean>;
  dismissRefreshNotice(): void;
  selectVariant(masterId: string, streamId: string): void;
  setPreferredVersion(choice: VersionChoice | null): void;
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
  {
    sort: 'added',
    order: 'desc',
    get label() {
      return t('Recently added');
    },
  },
  {
    sort: 'added',
    order: 'asc',
    get label() {
      return t('Oldest added');
    },
  },
  {
    sort: 'title',
    order: 'asc',
    get label() {
      return t('Name A–Z');
    },
  },
  {
    sort: 'title',
    order: 'desc',
    get label() {
      return t('Name Z–A');
    },
  },
  {
    sort: 'released',
    order: 'desc',
    get label() {
      return t('Newest release');
    },
  },
  {
    sort: 'released',
    order: 'asc',
    get label() {
      return t('Oldest release');
    },
  },
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
    // A refresh the user asked for: its result is announced when a status read shows it finished (D-119).
    let refreshAsked = false;
    const statusLoader = createResourceLoader<LibraryStatus[]>(
      () => ({ status: get().status }),
      (_, resource) => {
        set({ status: resource });
        if (!refreshAsked || resource.status !== 'success') return;
        const notice = describeLibraryRefresh(resource.data);
        if (notice) {
          refreshAsked = false;
          set({ refreshNotice: notice });
        }
      },
    );

    return {
      pages: {},
      details: {},
      status: emptyResource(),
      selectedVariants: {},
      preferredVersion: null,
      syncing: false,
      syncError: null,
      refreshNotice: null,
      sortChoices: {},

      loadPage: (section, query = {}, options) =>
        pageLoader.load(pageKey(section, query), () => api.library.list(section, { limit: DEFAULT_PAGE_SIZE, ...query }), options),

      loadDetails: (section, masterId, options) =>
        detailsLoader.load(detailsKey(section, masterId), () => api.library.get(section, masterId), options),

      refreshStatus: () => statusLoader.load('status', () => api.library.status(), { force: true }),

      async sync() {
        set({ syncing: true, syncError: null, refreshNotice: null });
        try {
          await api.library.sync();
          refreshAsked = true;
          // The update now shows as "processing": read that before `syncing` ends, or watchers that polled while
          // syncing saw the old "done" and stopped (the first "Refresh library" seemed to do nothing, D-119). A status
          // read still in flight from before the update is dropped, not shared.
          statusLoader.invalidate();
          await statusLoader.load('status', () => api.library.status(), { force: true });
          set({ syncing: false });
          return true;
        } catch (error) {
          set({ syncing: false, syncError: toApiError(error) });
          return false;
        }
      },

      dismissRefreshNotice: () => set({ refreshNotice: null }),

      selectVariant: (masterId, streamId) => set({ selectedVariants: { ...get().selectedVariants, [masterId]: streamId } }),

      setPreferredVersion: (preferredVersion) => set({ preferredVersion }),

      chooseSort: (section, choice) => set({ sortChoices: { ...get().sortChoices, [section]: choice } }),

      invalidate: () => {
        pageLoader.invalidate();
        detailsLoader.invalidate();
        set({ pages: {}, details: {} });
      },

      reset: () => {
        refreshAsked = false;
        for (const loader of [pageLoader, detailsLoader, statusLoader]) loader.invalidate();
        set({
          pages: {},
          details: {},
          status: emptyResource(),
          selectedVariants: {},
          syncing: false,
          refreshNotice: null,
          syncError: null,
          sortChoices: {},
        });
      },
    };
  });
}

export type LibraryStore = ReturnType<typeof createLibraryStore>;

/**
 * The chosen variant; else the one matching the profile's version choice (D-087); else the best one (variants are ordered
 * variants best-first).
 */
export function selectVariant(
  state: Pick<LibraryState, 'selectedVariants'> & Partial<Pick<LibraryState, 'preferredVersion'>>,
  details: MasterDetails,
): VariantInfo | null {
  const chosen = state.selectedVariants[details.id];
  return (
    details.variants.find((variant) => variant.streamId === chosen) ??
    preferredVariant(details.variants, state.preferredVersion) ??
    details.variants[0] ??
    null
  );
}

/** True while any library kind still has a queued or running normalization job. */
export function isLibraryProcessing(statuses: LibraryStatus[] | null): boolean {
  return (statuses ?? []).some((status) => status.jobStatus === 'pending' || status.jobStatus === 'processing');
}

const count = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * One line per library kind for the "organizing your library" notice. Uses the direct-mode stage and count when
 * present (D-038) and the plain job states otherwise. Empty when nothing is running.
 */
export function describeLibraryProgress(statuses: LibraryStatus[] | null): string[] {
  if (!isLibraryProcessing(statuses)) return [];
  return (statuses ?? []).map((status) => {
    const { stage, parsedCount } = status as LibraryStatusProgress;
    const label = status.mediaKind === 'series' ? t('Series') : t('Movies');
    const total = status.itemCount ?? 0;
    switch (status.jobStatus) {
      case 'pending':
        return t('{section}: waiting to start…', { section: label });
      case 'processing':
        if (stage === 'downloading') return t('{section}: downloading the list from your provider…', { section: label });
        if (stage === 'waiting' && total > 0)
          return t('{section}: {count} titles downloaded, grouping next…', { section: label, count: count(total) });
        // Direct mode: `parsedCount` runs to `itemCount` over all grouping steps, so a percentage reads right.
        if (stage === 'grouping' && total > 0)
          return t('{section}: grouping {count} titles, {percent}%…', {
            section: label,
            count: count(total),
            percent: Math.floor((100 * (parsedCount ?? 0)) / total),
          });
        return total > 0
          ? t('{section}: grouping {count} titles…', { section: label, count: count(total) })
          : t('{section}: grouping titles…', { section: label });
      case 'failed':
        return `${t('{section}: failed', { section: label })}${status.error ? ` (${status.error})` : ''}`;
      default:
        return t('{section}: {count} titles ready', { section: label, count: count(status.masterCount) });
    }
  });
}

/**
 * What a finished refresh did (D-119): up to date, or how many titles were added, changed and removed; `null` while it
 * runs. A failed list says so; a first build (nothing to compare with) only says the library was updated.
 */
export function describeLibraryRefresh(statuses: LibraryStatus[] | null): string | null {
  if (!statuses?.length || isLibraryProcessing(statuses)) return null;
  const list = statuses as LibraryStatusProgress[];
  const failed = list.find((status) => status.jobStatus === 'failed');
  if (failed) return t('The library could not be updated: {error}', { error: failed.error ?? t('unknown error') });
  if (list.some((status) => !status.changes)) return t('Your library was updated.');
  let added = 0;
  let changed = 0;
  let removed = 0;
  for (const status of list) {
    added += status.changes!.added;
    changed += status.changes!.changed;
    removed += status.changes!.removed;
  }
  if (added + changed + removed === 0) return t('Your library is up to date: nothing new from your provider.');
  return t('Library updated: {added} new, {changed} changed and {removed} removed titles.', {
    added: count(added),
    changed: count(changed),
    removed: count(removed),
  });
}
