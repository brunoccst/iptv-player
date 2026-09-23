import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { StoreApi } from 'zustand/vanilla';
import type { ApiError } from './api/httpClient';
import type { EpgChannelRow, EpgStatus } from './api/types';
import { EPG_DEFAULT_LIMIT, epgGridKey, type EpgGridRequest, type EpgState } from './stores/epgStore';

/**
 * React binding for the vanilla stores: `useAppStore(stores.session, (s) => s.status)`.
 * Shallow comparison lets selectors return derived arrays/objects (`s.items ?? []`, `.filter(...)`) without
 * re-render loops: a new array with the same elements counts as unchanged.
 */
export function useAppStore<TState, TSlice>(store: StoreApi<TState>, selector: (state: TState) => TSlice): TSlice {
  return useStore(store, useShallow(selector));
}

/** Current time in epoch ms, updated every `intervalMs` (guide "now" line, progress). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export interface EpgGuideView {
  rows: EpgChannelRow[];
  status: EpgStatus | null;
  totalChannels: number;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Guide pages 0..pageCount-1 for one category + window, concatenated. Each page polls while the backend's first
 * download runs (`watchGrid`); a `refresh()` restarts the watchers.
 */
export function useEpgGuide(
  store: StoreApi<EpgState>,
  window: Pick<EpgGridRequest, 'categoryId' | 'from' | 'hours'>,
  pageCount = 1,
  limit = EPG_DEFAULT_LIMIT,
): EpgGuideView {
  const { categoryId, from, hours } = window;
  const revision = useStore(store, (s) => s.revision);
  const requests = useMemo(
    () => Array.from({ length: Math.max(1, pageCount) }, (_, page) => ({ categoryId, from, hours, offset: page * limit, limit })),
    [categoryId, from, hours, pageCount, limit],
  );

  useEffect(() => {
    const stops = requests.map((request) => store.getState().watchGrid(request));
    return () => stops.forEach((stop) => stop());
  }, [store, requests, revision]);

  const resources = useAppStore(store, (s) => requests.map((request) => s.grids[epgGridKey(request)]));
  return useMemo(() => {
    const first = resources[0];
    return {
      rows: resources.flatMap((resource) => resource?.data?.channels ?? []),
      status: first?.data?.status ?? null,
      totalChannels: first?.data?.totalChannels ?? 0,
      loading: resources.some((resource) => !resource || (resource.status === 'loading' && !resource.data)),
      error: resources.find((resource) => resource?.error)?.error ?? null,
    };
  }, [resources]);
}
