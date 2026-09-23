import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { EpgGrid } from '../api/types';
import { createResourceLoader, type LoadOptions, type Resource } from './resource';

/** One guide page. `from` is a slot-aligned epoch ms (see `floorToSlot`). */
export interface EpgGridRequest {
  categoryId: string | null;
  from: number;
  hours: number;
  offset?: number;
  limit?: number;
}

export const EPG_DEFAULT_LIMIT = 50;
/** Poll interval while the backend downloads the guide for the first time. */
export const EPG_POLL_MS = 3000;

export const epgGridKey = (r: EpgGridRequest) =>
  `${r.categoryId ?? '*'}|${r.from}|${r.hours}|${r.offset ?? 0}|${r.limit ?? EPG_DEFAULT_LIMIT}`;

export interface EpgState {
  grids: Record<string, Resource<EpgGrid>>;
  /** Bumped by `refresh`/`reset` so watchers restart. */
  revision: number;
  loadGrid(request: EpgGridRequest, options?: LoadOptions): Promise<EpgGrid | null>;
  /** Loads the page and re-polls while its status is `refreshing`. Returns a stop function (call on unmount). */
  watchGrid(request: EpgGridRequest): () => void;
  /** Asks the backend to download the guide again; cached pages reload on next watch. */
  refresh(): Promise<boolean>;
  reset(): void;
}

export function createEpgStore({ api, pollMs = EPG_POLL_MS }: { api: ApiClient; pollMs?: number }) {
  return createStore<EpgState>()((set, get) => {
    const loader = createResourceLoader<EpgGrid>(
      () => get().grids,
      (key, resource) => set({ grids: { ...get().grids, [key]: resource } }),
    );

    return {
      grids: {},
      revision: 0,
      loadGrid: (request, options) => loader.load(epgGridKey(request), () => api.epg.grid({
        categoryId: request.categoryId,
        from: new Date(request.from).toISOString(),
        hours: request.hours,
        offset: request.offset ?? 0,
        limit: request.limit ?? EPG_DEFAULT_LIMIT,
      }), options),

      watchGrid(request) {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async (force: boolean) => {
          const grid = await get().loadGrid(request, { force });
          if (!stopped && grid?.status === 'refreshing') timer = setTimeout(() => void tick(true), pollMs);
        };
        void tick(false);
        return () => {
          stopped = true;
          if (timer) clearTimeout(timer);
        };
      },

      async refresh() {
        try {
          await api.epg.refresh();
          loader.invalidate();
          set({ grids: {}, revision: get().revision + 1 });
          return true;
        } catch {
          return false;
        }
      },

      reset: () => {
        loader.invalidate();
        set({ grids: {}, revision: get().revision + 1 });
      },
    };
  });
}

export type EpgStore = ReturnType<typeof createEpgStore>;
