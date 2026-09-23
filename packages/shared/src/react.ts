import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { StoreApi } from 'zustand/vanilla';

/**
 * React binding for the vanilla stores: `useAppStore(stores.session, (s) => s.status)`.
 * Shallow comparison lets selectors return derived arrays/objects (`s.items ?? []`, `.filter(...)`) without
 * re-render loops: a new array with the same elements counts as unchanged.
 */
export function useAppStore<TState, TSlice>(store: StoreApi<TState>, selector: (state: TState) => TSlice): TSlice {
  return useStore(store, useShallow(selector));
}
