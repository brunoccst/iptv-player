import { decryptChunk } from './chunkCrypto';
import type { ChunkStore } from './chunkStore';
import type { OfflineDb } from './offlineDb';
import { clampToChunk, parseRange } from './ranges';
import { CHUNK_SIZE, OFFLINE_PREFIX, type DownloadRecord } from './types';

export interface OfflineResponderDeps {
  db: OfflineDb;
  chunks: ChunkStore;
}

const notFound = () => new Response('Not downloaded', { status: 404 });

/** Serves `/__offline__/{id}/...` from encrypted storage. Runs inside the Service Worker. See DECISIONS.md#d-024. */
export async function respondOffline(url: URL, rangeHeader: string | null, deps: OfflineResponderDeps): Promise<Response> {
  const match = new RegExp(`^${OFFLINE_PREFIX}([\\w-]+)/(index\\.m3u8|file|poster|r/(\\d+))$`).exec(url.pathname);
  if (!match) return notFound();
  const [, id, resource, partIndex] = match as unknown as [string, string, string, string | undefined];

  if (resource === 'poster') return (await deps.chunks.getPoster(id)) ?? notFound();

  const record = await deps.db.getDownload(id);
  if (!record || record.status !== 'completed') return notFound();

  if (resource === 'index.m3u8' && record.format === 'hls' && record.playlist) {
    return new Response(record.playlist, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
  }

  const key = await deps.db.getKey(id);
  if (!key) return notFound();

  if (partIndex !== undefined && record.format === 'hls') {
    const payload = await deps.chunks.get(id, Number(partIndex));
    return payload ? new Response(await decryptChunk(key, payload)) : notFound();
  }

  if (resource === 'file' && record.format === 'file' && record.totalBytes) {
    return respondFile(record, key, rangeHeader, deps.chunks);
  }
  return notFound();
}

async function respondFile(record: DownloadRecord, key: CryptoKey, rangeHeader: string | null, chunks: ChunkStore): Promise<Response> {
  const total = record.totalBytes!;
  const headers = { 'Content-Type': record.mimeType ?? 'video/mp4', 'Accept-Ranges': 'bytes' };
  const range = parseRange(rangeHeader, total);

  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${total}` } });
  }

  if (range === null) {
    // No Range header: stream every chunk in order.
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (index >= record.totalParts) return controller.close();
        const payload = await chunks.get(record.id, index++);
        if (!payload) return controller.error(new Error('Missing chunk'));
        controller.enqueue(new Uint8Array(await decryptChunk(key, payload)));
      },
    });
    return new Response(stream, { status: 200, headers: { ...headers, 'Content-Length': String(total) } });
  }

  const clamped = clampToChunk(range, CHUNK_SIZE);
  const payload = await chunks.get(record.id, clamped.chunk);
  if (!payload) return notFound();
  const plain = new Uint8Array(await decryptChunk(key, payload));
  const body = plain.subarray(clamped.offset, clamped.offset + (clamped.end - clamped.start + 1));
  return new Response(body, {
    status: 206,
    headers: { ...headers, 'Content-Length': String(body.length), 'Content-Range': `bytes ${clamped.start}-${clamped.end}/${total}` },
  });
}
