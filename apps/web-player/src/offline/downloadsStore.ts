import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '@iptv/shared';
import type { ChunkStore } from './chunkStore';
import { DownloadManager } from './downloadManager';
import type { OfflineDb } from './offlineDb';
import { downloadId, type DownloadKind, type DownloadRecord, type DownloadTarget } from './types';

export interface DownloadsState {
  supported: boolean;
  ready: boolean;
  records: Record<string, DownloadRecord>;
  estimate: { usage: number; quota: number } | null;
  init(): Promise<void>;
  start(target: DownloadTarget): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  refreshEstimate(): Promise<void>;
}

export interface DownloadsStoreDeps {
  api: ApiClient;
  db: OfflineDb;
  chunks: ChunkStore;
  supported: boolean;
  storage?: Pick<StorageManager, 'estimate' | 'persist'>;
}

export function createDownloadsStore({ api, db, chunks, supported, storage }: DownloadsStoreDeps) {
  return createStore<DownloadsState>()((set, get) => {
    const manager = new DownloadManager({
      api,
      db,
      chunks,
      onChange: (change) => {
        const records = { ...get().records };
        if ('deleted' in change) delete records[change.id];
        else records[change.id] = change;
        set({ records });
      },
    });

    return {
      supported,
      ready: false,
      records: {},
      estimate: null,

      async init() {
        if (!supported || get().ready) return set({ ready: true });
        const records = await manager.restore();
        set({ ready: true, records: Object.fromEntries(records.map((record) => [record.id, record])) });
        void get().refreshEstimate();
      },

      async start(target) {
        if (!supported) return;
        void storage?.persist?.(); // ask the browser not to evict downloads under storage pressure
        await manager.enqueue(target);
      },
      pause: (id) => manager.pause(id),
      resume: (id) => manager.resume(id),
      async remove(id) {
        await manager.remove(id);
        void get().refreshEstimate();
      },

      async refreshEstimate() {
        const estimate = await storage?.estimate?.().catch(() => null);
        if (estimate) set({ estimate: { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 } });
      },
    };
  });
}

export type DownloadsStore = ReturnType<typeof createDownloadsStore>;

export const selectDownload = (state: Pick<DownloadsState, 'records'>, kind: DownloadKind, streamId: string): DownloadRecord | null =>
  state.records[downloadId(kind, streamId)] ?? null;
