import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { ApiError } from '../api/httpClient';
import type { LibrarySection, MasterCard, WatchlistDto } from '../api/types';
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

/** A saved entry shown like a library card (rows and the My List page). */
export const watchlistCard = (item: WatchlistDto): MasterCard => ({
  id: item.masterId,
  title: item.title,
  year: item.year,
  posterUrl: item.posterUrl,
  rating: null,
  bestQuality: null,
  variantCount: 1,
});

export function createWatchlistStore({ api, now = () => new Date().toISOString() }: { api: ApiClient; now?: () => string }) {
  return createStore<WatchlistState>()((set, get) => {
    let inFlight: { profileId: string; promise: Promise<void> } | null = null;
    const setData = (data: WatchlistDto[]) => set({ items: { ...get().items, data } });

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
              if (get().profileId === profileId) set({ items: { data, status: 'success', error: null, updatedAt: Date.now() } });
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
