import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { ApiError } from '../api/httpClient';
import type { ProgressDto, ProgressKind, ProgressRequest } from '../api/types';
import { emptyResource, toApiError, type Resource } from './resource';

/** Watch progress of the active profile. Saves are optimistic: the list updates before the server answers. */
export interface ProgressState {
  profileId: string | null;
  items: Resource<ProgressDto[]>;
  saveError: ApiError | null;
  load(profileId: string, options?: { force?: boolean }): Promise<void>;
  save(kind: ProgressKind, itemId: string, request: ProgressRequest): Promise<void>;
  remove(kind: ProgressKind, itemId: string): Promise<void>;
  reset(): void;
}

export function createProgressStore({ api, now = () => new Date().toISOString() }: { api: ApiClient; now?: () => string }) {
  return createStore<ProgressState>()((set, get) => {
    let inFlight: { profileId: string; promise: Promise<void> } | null = null;

    const upsert = (entry: ProgressDto) => {
      const rest = (get().items.data ?? []).filter((p) => !(p.kind === entry.kind && p.itemId === entry.itemId));
      set({ items: { ...get().items, data: [entry, ...rest] } });
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
        const promise = api.progress
          .list(profileId, 100)
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

      async save(kind, itemId, request) {
        const { profileId } = get();
        if (!profileId) return;
        upsert({
          kind,
          itemId,
          updatedAt: now(),
          title: request.title,
          positionSeconds: request.positionSeconds,
          durationSeconds: request.durationSeconds,
          masterId: request.masterId ?? null,
          seriesId: request.seriesId ?? null,
          seasonNumber: request.seasonNumber ?? null,
          episodeNumber: request.episodeNumber ?? null,
          posterUrl: request.posterUrl ?? null,
          containerExtension: request.containerExtension ?? null,
        });
        try {
          await api.progress.save(profileId, kind, itemId, request);
          set({ saveError: null });
        } catch (error) {
          set({ saveError: toApiError(error) });
        }
      },

      async remove(kind, itemId) {
        const { profileId, items } = get();
        if (!profileId) return;
        set({ items: { ...items, data: (items.data ?? []).filter((p) => !(p.kind === kind && p.itemId === itemId)) } });
        await api.progress.remove(profileId, kind, itemId).catch((error: unknown) => set({ saveError: toApiError(error) }));
      },

      reset: () => {
        inFlight = null;
        set({ profileId: null, items: emptyResource(), saveError: null });
      },
    };
  });
}

export type ProgressStore = ReturnType<typeof createProgressStore>;

export function findProgress(state: Pick<ProgressState, 'items'>, kind: ProgressKind, itemId: string): ProgressDto | null {
  return state.items.data?.find((item) => item.kind === kind && item.itemId === itemId) ?? null;
}
