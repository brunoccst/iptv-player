import type { ApiClient } from '@iptv/shared';
import { isBrowserNativeContainer, mimeTypeForContainer } from '@iptv/shared';
import { encryptChunk, generateChunkKey } from './chunkCrypto';
import type { ChunkStore } from './chunkStore';
import { isMasterPlaylist, pickBestVariant, prepareOfflinePlaylist } from './hlsPlaylist';
import type { OfflineDb } from './offlineDb';
import { CHUNK_SIZE, OFFLINE_PREFIX, downloadId, type DownloadRecord, type DownloadTarget } from './types';

export interface DownloadManagerDeps {
  api: ApiClient;
  db: OfflineDb;
  chunks: ChunkStore;
  fetch?: typeof fetch;
  now?: () => number;
  /** Called after every persisted change. */
  onChange: (record: DownloadRecord | { id: string; deleted: true }) => void;
  /** Parallel requests per HLS download. */
  concurrency?: number;
}

export class OfflineUnsupportedError extends Error {}

/**
 * Downloads one item at a time (providers limit connections) into encrypted chunks.
 * Resumable: existing chunks are skipped. See DECISIONS.md#d-024.
 */
export class DownloadManager {
  private readonly queue: string[] = [];
  private active: { id: string; controller: AbortController } | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly deps: DownloadManagerDeps) {
    this.fetchImpl = deps.fetch ?? ((...args) => globalThis.fetch(...args));
    this.now = deps.now ?? Date.now;
  }

  /** Interrupted downloads (page closed) come back as paused. */
  async restore(): Promise<DownloadRecord[]> {
    const records = await this.deps.db.listDownloads();
    for (const record of records) {
      if (record.status === 'downloading' || record.status === 'queued') {
        await this.save({ ...record, status: 'paused' });
      }
    }
    return this.deps.db.listDownloads();
  }

  async enqueue(target: DownloadTarget): Promise<DownloadRecord> {
    const id = downloadId(target.kind, target.streamId);
    const existing = await this.deps.db.getDownload(id);
    if (existing?.status === 'completed') return existing;

    if (!(await this.deps.db.getKey(id))) await this.deps.db.putKey(id, await generateChunkKey());
    const record: DownloadRecord = existing
      ? { ...existing, status: 'queued', error: null }
      : {
          ...target,
          id,
          status: 'queued',
          format: null,
          playlist: null,
          totalParts: 0,
          completedParts: 0,
          totalBytes: null,
          bytesDownloaded: 0,
          mimeType: null,
          createdAt: this.now(),
          updatedAt: this.now(),
          error: null,
        };
    await this.save(record);
    if (!this.queue.includes(id) && this.active?.id !== id) this.queue.push(id);
    void this.pump();
    return record;
  }

  async resume(id: string): Promise<void> {
    const record = await this.deps.db.getDownload(id);
    if (record && record.status !== 'completed') await this.enqueue(record);
  }

  async pause(id: string): Promise<void> {
    this.removeFromQueue(id);
    if (this.active?.id === id) this.active.controller.abort();
    const record = await this.deps.db.getDownload(id);
    if (record && record.status !== 'completed') await this.save({ ...record, status: 'paused' });
  }

  async remove(id: string): Promise<void> {
    this.removeFromQueue(id);
    if (this.active?.id === id) this.active.controller.abort();
    await this.deps.chunks.removeAll(id);
    await this.deps.db.deleteKey(id);
    await this.deps.db.deleteDownload(id);
    this.deps.onChange({ id, deleted: true });
  }

  /** Resolves when the queue is empty. For tests. */
  async idle(): Promise<void> {
    while (this.active || this.queue.length > 0) await new Promise((resolve) => setTimeout(resolve, 5));
  }

  private removeFromQueue(id: string) {
    const index = this.queue.indexOf(id);
    if (index >= 0) this.queue.splice(index, 1);
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    const id = this.queue.shift();
    if (!id) return;
    const controller = new AbortController();
    this.active = { id, controller };
    try {
      const record = await this.deps.db.getDownload(id);
      if (record) await this.run(record, controller.signal);
    } finally {
      this.active = null;
      void this.pump();
    }
  }

  private async run(initial: DownloadRecord, signal: AbortSignal): Promise<void> {
    let record: DownloadRecord = { ...initial, status: 'downloading' };
    await this.save(record);
    try {
      const key = await this.deps.db.getKey(record.id);
      if (!key) throw new Error('Encryption key missing.');
      record = (await this.tryHls(record, key, signal)) ?? (await this.downloadFile(record, key, signal));
      await this.savePoster(record);
      await this.save({ ...record, status: 'completed', error: null });
    } catch (error) {
      if (signal.aborted) return; // pause() / remove() already persisted the new state.
      const latest = (await this.deps.db.getDownload(record.id)) ?? record;
      await this.save({ ...latest, status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Returns null when the panel offers no HLS for this item (caller falls back to the file). */
  private async tryHls(record: DownloadRecord, key: CryptoKey, signal: AbortSignal): Promise<DownloadRecord | null> {
    if (record.format === 'file') return null;
    const playback = await this.deps.api.playback.get(record.kind, record.streamId, 'm3u8').catch(() => null);
    if (!playback) return null;
    let response = await this.fetchImpl(playback.url, { signal }).catch(() => null);
    let text = response?.ok ? await response.text() : '';
    if (!response || !text.trimStart().startsWith('#EXTM3U')) return null;

    if (isMasterPlaylist(text)) {
      const variant = pickBestVariant(text, response.url || playback.url);
      if (!variant) return null;
      response = await this.fetchImpl(variant.url, { signal });
      text = await response.text();
    }

    const prepared = prepareOfflinePlaylist(text, response.url || playback.url, (i) => `${OFFLINE_PREFIX}${record.id}/r/${i}`);
    if (record.totalParts && record.totalParts !== prepared.resources.length) {
      await this.deps.chunks.removeAll(record.id); // Upstream playlist changed: restart.
      record = { ...record, completedParts: 0, bytesDownloaded: 0 };
    }
    record = { ...record, format: 'hls', playlist: prepared.playlist, totalParts: prepared.resources.length };
    await this.saveProgress(record, signal);

    let next = 0;
    const worker = async () => {
      while (next < prepared.resources.length) {
        const index = next++;
        if (await this.deps.chunks.has(record.id, index)) continue;
        const part = await this.fetchOk(prepared.resources[index]!, signal);
        const data = await part.arrayBuffer();
        await this.deps.chunks.put(record.id, index, await encryptChunk(key, data));
        record = { ...record, completedParts: record.completedParts + 1, bytesDownloaded: record.bytesDownloaded + data.byteLength };
        await this.saveProgress(record, signal);
      }
    };
    await Promise.all(Array.from({ length: this.deps.concurrency ?? 3 }, worker));
    return { ...record, completedParts: prepared.resources.length };
  }

  private async downloadFile(record: DownloadRecord, key: CryptoKey, signal: AbortSignal): Promise<DownloadRecord> {
    const container = record.container ?? 'mp4';
    if (!isBrowserNativeContainer(container)) {
      throw new OfflineUnsupportedError(`${container.toUpperCase()} files cannot play in a browser. Download it on the TV app instead.`);
    }
    const playback = await this.deps.api.playback.get(record.kind, record.streamId, container);
    record = { ...record, format: 'file', mimeType: mimeTypeForContainer(container) };

    const first = await this.fetchOk(playback.url, signal, `bytes=0-${CHUNK_SIZE - 1}`);
    const total = Number(/\/(\d+)$/.exec(first.headers.get('Content-Range') ?? '')?.[1] ?? first.headers.get('Content-Length') ?? 0);
    if (!total) throw new Error('Unknown file size.');
    record = { ...record, totalBytes: total, totalParts: Math.ceil(total / CHUNK_SIZE) };
    await this.saveProgress(record, signal);

    if (first.status === 200) return this.storeWholeBody(record, key, first, signal);

    const store = async (index: number, response: Response) => {
      const data = await response.arrayBuffer();
      await this.deps.chunks.put(record.id, index, await encryptChunk(key, data));
      record = { ...record, completedParts: record.completedParts + 1, bytesDownloaded: record.bytesDownloaded + data.byteLength };
      await this.saveProgress(record, signal);
    };

    if (await this.deps.chunks.has(record.id, 0)) await first.body?.cancel();
    else await store(0, first);

    for (let index = 1; index < record.totalParts; index++) {
      if (await this.deps.chunks.has(record.id, index)) continue;
      const end = Math.min(total, (index + 1) * CHUNK_SIZE) - 1;
      await store(index, await this.fetchOk(playback.url, signal, `bytes=${index * CHUNK_SIZE}-${end}`));
    }
    return { ...record, completedParts: record.totalParts };
  }

  /** Server ignored Range: split the single response into chunks. */
  private async storeWholeBody(record: DownloadRecord, key: CryptoKey, response: Response, signal: AbortSignal): Promise<DownloadRecord> {
    const bytes = new Uint8Array(await response.arrayBuffer());
    for (let index = 0; index < record.totalParts; index++) {
      const slice = bytes.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
      await this.deps.chunks.put(record.id, index, await encryptChunk(key, slice));
      record = { ...record, completedParts: index + 1, bytesDownloaded: Math.min(bytes.length, (index + 1) * CHUNK_SIZE) };
      await this.saveProgress(record, signal);
    }
    return record;
  }

  private async savePoster(record: DownloadRecord) {
    if (!record.posterUrl) return;
    // Provider artwork has no CORS headers: an opaque response is still cacheable and renders in <img>.
    const poster = await this.fetchImpl(record.posterUrl, { mode: 'no-cors' }).catch(() => null);
    if (poster) await this.deps.chunks.putPoster(record.id, poster).catch(() => undefined);
  }

  private async fetchOk(url: string, signal: AbortSignal, range?: string): Promise<Response> {
    const response = await this.fetchImpl(url, { signal, headers: range ? { Range: range } : undefined });
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    return response;
  }

  /** Progress write from a running download. Throws once paused/removed so no stale status overwrites theirs. */
  private async saveProgress(record: DownloadRecord, signal: AbortSignal) {
    if (signal.aborted) throw new DOMException('Download aborted', 'AbortError');
    await this.save(record);
  }

  private async save(record: DownloadRecord) {
    const updated = { ...record, updatedAt: this.now() };
    await this.deps.db.putDownload(updated);
    this.deps.onChange(updated);
  }
}
