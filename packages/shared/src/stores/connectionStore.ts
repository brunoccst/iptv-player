import { createStore } from 'zustand/vanilla';
import type { KeyValueStorage } from './storage';

export const CONNECTION_STORAGE_KEY = 'connection';

/** `direct`: the app talks to the IPTV provider. `server`: through the backend at `serverUrl`. See DECISIONS.md#d-038. */
export type ConnectionMode = 'direct' | 'server';

export interface ConnectionState {
  mode: ConnectionMode;
  serverUrl: string;
  loaded: boolean;
  /** Reads the saved choice once; later calls return the same promise. */
  load(): Promise<void>;
  setConnection(mode: ConnectionMode, serverUrl?: string): Promise<void>;
}

export function createConnectionStore({ storage, defaultServerUrl = '' }: { storage: KeyValueStorage; defaultServerUrl?: string }) {
  let loading: Promise<void> | null = null;
  return createStore<ConnectionState>()((set, get) => ({
    mode: 'direct',
    serverUrl: defaultServerUrl,
    loaded: false,
    load() {
      loading ??= (async () => {
        try {
          const saved = JSON.parse((await storage.getItem(CONNECTION_STORAGE_KEY)) ?? 'null') as Partial<ConnectionState> | null;
          if (saved?.mode === 'direct' || saved?.mode === 'server')
            set({ mode: saved.mode, serverUrl: saved.serverUrl || defaultServerUrl });
        } catch {
          // A broken value falls back to direct mode.
        }
        set({ loaded: true });
      })();
      return loading;
    },
    async setConnection(mode, serverUrl) {
      const url = (serverUrl ?? get().serverUrl).trim().replace(/\/+$/, '');
      set({ mode, serverUrl: url, loaded: true });
      await storage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify({ mode, serverUrl: url }));
    },
  }));
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>;
