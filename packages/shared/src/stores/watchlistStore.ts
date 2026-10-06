import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { ApiError } from '../api/errors';
import type { LibrarySection, MasterCard, MasterDetails, WatchlistDto } from '../api/types';
import { lowSourceOf } from '../direct/normalizer/pipeline';
import { emptyResource, toApiError, type Resource } from './resource';

/** "My List" of the active profile (D-055). Adding and removing update the list before the server answers. */
export interface WatchlistState {
  profileId: string | null;
  items: Resource<WatchlistDto[]>;
  saveError: ApiError | null;
  load(profileId: string, options?: { force?: boolean }): Promise<void>;
  /** Adds the title when missing, removes it when present. */
  toggle(section: LibrarySection, card: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>): Promise<void>;
  reset(): void;
}

export const isOnWatchlist = (state: Pick<WatchlistState, 'items'>, section: LibrarySection, masterId: string) =>
  (state.items.data ?? []).some((item) => item.section === section && item.masterId === masterId);

/**
 * A saved entry shown like a library card (rows and the My List page), with the quality badge and versions the library
 * gives it once read (issue: My List covers had no 4K or TS badge).
 */
export const watchlistCard = (item: WatchlistDto): MasterCard => ({
  id: item.masterId,
  title: item.title,
  year: item.year,
  posterUrl: item.posterUrl,
  rating: item.quality?.rating ?? null,
  bestQuality: item.quality?.bestQuality ?? null,
  lowSource: item.quality?.lowSource ?? null,
  variantCount: item.quality?.variantCount ?? 1,
});

const qualityOf = (details: MasterDetails): NonNullable<WatchlistDto['quality']> => ({
  bestQuality: details.bestQuality,
  lowSource: lowSourceOf(details.variants.map((variant) => variant.source)),
  rating: details.rating,
  variantCount: details.variants.length,
});

const entryKey = (item: Pick<WatchlistDto, 'section' | 'masterId'>) => `${item.section}:${item.masterId}`;

export function createWatchlistStore({ api, now = () => new Date().toISOString() }: { api: ApiClient; now?: () => string }) {
  return createStore<WatchlistState>()((set, get) => {
    let inFlight: { profileId: string; promise: Promise<void> } | null = null;
    const setData = (data: WatchlistDto[]) => set({ items: { ...get().items, data } });

    /** Reads the quality of the entries that lack it from the library, all at once, and shows it in one update. */
    const readQuality = async (profileId: string) => {
      const missing = (get().items.data ?? []).filter((item) => !item.quality);
      if (missing.length === 0) return;
      const found = new Map<string, WatchlistDto['quality']>();
      await Promise.all(
        missing.map((item) =>
          api.library.get(item.section, item.masterId).then(
            (details) => found.set(entryKey(item), qualityOf(details)),
            // A title gone from the library keeps a plain cover.
            () => undefined,
          ),
        ),
      );
      if (found.size === 0 || get().profileId !== profileId) return;
      setData(
        (get().items.data ?? []).map((item) =>
          item.quality || !found.has(entryKey(item)) ? item : { ...item, quality: found.get(entryKey(item)) },
        ),
      );
    };

    return {
      profileId: null,
      items: emptyResource(),
      saveError: null,

      load(profileId, { force = false } = {}) {
        const { items, profileId: current } = get();
        if (!force && current === profileId) {
          if (inFlight?.profileId === profileId) return inFlight.promise;
          if (items.status === 'success') return Promise.resolve();
        }
        set({ profileId, items: { ...emptyResource(), status: 'loading' } });
        const promise = api.watchlist
          .list(profileId)
          .then(
            (data) => {
              if (get().profileId !== profileId) return;
              set({ items: { data, status: 'success', error: null, updatedAt: Date.now() } });
              void readQuality(profileId);
            },
            (error: unknown) => {
              if (get().profileId === profileId) set({ items: { ...get().items, status: 'error', error: toApiError(error) } });
            },
          )
          .finally(() => {
            if (inFlight?.promise === promise) inFlight = null;
          });
        inFlight = { profileId, promise };
        return promise;
      },

      async toggle(section, card) {
        const { profileId } = get();
        if (!profileId) return;
        const before = get().items.data ?? [];
        const present = isOnWatchlist(get(), section, card.id);
        setData(
          present
            ? before.filter((item) => !(item.section === section && item.masterId === card.id))
            : [{ section, masterId: card.id, title: card.title, year: card.year, posterUrl: card.posterUrl, addedAt: now() }, ...before],
        );
        try {
          if (present) await api.watchlist.remove(profileId, section, card.id);
          else await api.watchlist.add(profileId, section, card.id, { title: card.title, year: card.year, posterUrl: card.posterUrl });
          set({ saveError: null });
          if (!present) void readQuality(profileId);
        } catch (error) {
          if (get().profileId === profileId) setData(before);
          set({ saveError: toApiError(error) });
        }
      },

      reset() {
        inFlight = null;
        set({ profileId: null, items: emptyResource(), saveError: null });
      },
    };
  });
}

export type WatchlistStore = ReturnType<typeof createWatchlistStore>;
