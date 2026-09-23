import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

/** React binding for the vanilla stores: `useAppStore(stores.session, (s) => s.status)`. */
export function useAppStore<TState, TSlice>(store: StoreApi<TState>, selector: (state: TState) => TSlice): TSlice {
  return useStore(store, selector);
}
