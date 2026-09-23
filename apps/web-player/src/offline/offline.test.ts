import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { downloadIdFor, type ApiClient } from '@iptv/shared';
import { decryptChunk, encryptChunk, generateChunkKey } from './chunkCrypto';
import { createMemoryChunkStore } from './chunkStore';
import { DownloadManager } from './downloadManager';
import { LivePlaylistError, pickBestVariant, prepareOfflinePlaylist } from './hlsPlaylist';
import { createOfflineDb } from './offlineDb';
import { respondOffline } from './offlineResponder';
import { clampToChunk, parseRange } from './ranges';
import { CHUNK_SIZE, downloadId, offlinePlaybackUrl, type DownloadRecord } from './types';

const origin = 'http://app.test';

function bytes(length: number, seed = 1): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(length);
  for (let i = 0; i < length; i++) result[i] = (i * 31 + seed) % 256;
  return result;
}

/** Byte comparison without Vitest's element-by-element diff (slow for megabytes). */
function expectSameBytes(actual: ArrayBuffer | Uint8Array, expected: Uint8Array) {
  const a = Buffer.from(actual instanceof Uint8Array ? actual : new Uint8Array(actual));
  expect(a.length).toBe(expected.length);
  expect(a.equals(Buffer.from(expected))).toBe(true);
}

/** Fake upstream: an HLS VOD (master → media, init map, AES key reference, 3 segments) and a ranged MP4 file. */
function fakeUpstream(file: Uint8Array<ArrayBuffer>, options: { hls?: boolean; honorRange?: boolean } = {}) {
  const hls = options.hls ?? true;
  const segments = [bytes(1000, 1), bytes(1500, 2), bytes(800, 3)];
  const requests: string[] = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const range = new Headers(init?.headers).get('Range');
    requests.push(url.pathname + (range ? ` ${range}` : ''));
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const ok = (body: BodyInit, headers: Record<string, string> = {}, status = 200) => {
      const response = new Response(body, { status, headers });
      Object.defineProperty(response, 'url', { value: url.href });
      return response;
    };
    switch (url.pathname) {
      case '/relay/master.m3u8':
        return hls
          ? ok('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\nlow/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=900\nhigh/index.m3u8\n')
          : ok('', {}, 404);
      case '/relay/high/index.m3u8':
        return ok(
          '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-KEY:METHOD=AES-128,URI="/keys/k.bin"\n#EXTINF:2,\ns0.m4s\n#EXTINF:2,\ns1.m4s\n#EXTINF:2,\ns2.m4s\n#EXT-X-ENDLIST\n',
        );
      case '/relay/high/init.mp4':
        return ok(bytes(64, 9));
      case '/keys/k.bin':
        return ok(bytes(16, 7));
      case '/relay/high/s0.m4s':
      case '/relay/high/s1.m4s':
      case '/relay/high/s2.m4s':
        return ok(segments[Number(/s(\d)\.m4s$/.exec(url.pathname)![1])]!);
      case '/relay/movie.mp4': {
        const match = range && options.honorRange !== false ? /bytes=(\d+)-(\d+)/.exec(range) : null;
        if (!match) return ok(file, { 'Content-Length': String(file.length) });
        const start = Number(match[1]);
        const end = Math.min(Number(match[2]), file.length - 1);
        return ok(file.slice(start, end + 1), { 'Content-Range': `bytes ${start}-${end}/${file.length}` }, 206);
      }
      case '/poster.jpg':
        return ok('poster');
      default:
        return ok('', {}, 404);
    }
  }) as typeof fetch;
  return { fetch: fakeFetch, segments, requests };
}

const api = {
  playback: {
    get: async (_kind: string, _id: string, container?: string | null) => ({
      url: container === 'm3u8' ? 'http://relay.test/relay/master.m3u8' : 'http://relay.test/relay/movie.mp4',
      container: container ?? 'mp4',
      isLive: false,
      deliveryMode: 'relay',
    }),
  },
} as unknown as ApiClient;

function setup(file = bytes(10), options: { hls?: boolean; honorRange?: boolean } = {}) {
  const db = createOfflineDb(new IDBFactory());
  const chunks = createMemoryChunkStore();
  const upstream = fakeUpstream(file, options);
  const changes: string[] = [];
  const manager = new DownloadManager({
    api,
    db,
    chunks,
    fetch: upstream.fetch,
    onChange: (change) => changes.push('deleted' in change ? `deleted:${change.id}` : `${change.status}:${change.completedParts}`),
  });
  return {
    db,
    chunks,
    upstream,
    manager,
    changes,
    respond: (path: string, range: string | null = null) => respondOffline(new URL(path, origin), range, { db, chunks }),
  };
}

const target = (streamId: string, container = 'mkv') => ({
  kind: 'movie' as const,
  streamId,
  container,
  title: 'Movie',
  posterUrl: 'http://relay.test/poster.jpg',
});

describe('chunk crypto', () => {
  it('round-trips and rejects tampering', async () => {
    const key = await generateChunkKey();
    const payload = await encryptChunk(key, bytes(100));

    expect(new Uint8Array(await decryptChunk(key, payload))).toEqual(bytes(100));
    const tampered = new Uint8Array(payload.slice(0));
    tampered[20]! ^= 1;
    await expect(decryptChunk(key, tampered.buffer)).rejects.toThrow();
  });
});

describe('hls playlist helpers', () => {
  it('picks the highest bandwidth variant', () => {
    expect(
      pickBestVariant('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=5\na.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=9\nb.m3u8', 'http://x/p/m.m3u8'),
    ).toEqual({ url: 'http://x/p/b.m3u8', bandwidth: 9 });
  });

  it('localizes every URI once and refuses live playlists', () => {
    const result = prepareOfflinePlaylist(
      '#EXTM3U\n#EXT-X-KEY:URI="k"\n#EXTINF:2,\na.ts\n#EXT-X-KEY:URI="k"\n#EXTINF:2,\nb.ts\n#EXT-X-ENDLIST',
      'http://x/p/i.m3u8',
      (i) => `/L/${i}`,
    );

    expect(result.resources).toEqual(['http://x/p/k', 'http://x/p/a.ts', 'http://x/p/b.ts']);
    expect(result.playlist).toBe(
      '#EXTM3U\n#EXT-X-KEY:URI="/L/0"\n#EXTINF:2,\n/L/1\n#EXT-X-KEY:URI="/L/0"\n#EXTINF:2,\n/L/2\n#EXT-X-ENDLIST',
    );
    expect(() => prepareOfflinePlaylist('#EXTM3U\n#EXTINF:2,\na.ts', 'http://x/', String)).toThrow(LivePlaylistError);
  });
});

describe('download ids', () => {
  it('match the shared format used by the TV app', () => {
    expect(downloadId('episode', 'a/b 1')).toBe(downloadIdFor('episode', 'a/b 1'));
  });
});

describe('ranges', () => {
  it('parses and clamps', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(parseRange('bytes=200-', 100)).toBe('invalid');
    expect(clampToChunk({ start: 5, end: 25 }, 10)).toEqual({ start: 5, end: 9, chunk: 0, offset: 5 });
  });
});

describe('download manager + offline responder', () => {
  it('downloads HLS into encrypted parts and serves the local playlist and decrypted parts', async () => {
    const { manager, chunks, upstream, respond, db } = setup();

    await manager.enqueue(target('101'));
    await manager.idle();

    const record = (await db.getDownload(downloadId('movie', '101')))!;
    expect(record).toMatchObject({ status: 'completed', format: 'hls', totalParts: 5, completedParts: 5 });
    expect(upstream.requests.filter((r) => r.startsWith('/relay/low'))).toEqual([]);

    const stored = await chunks.get(record.id, 2);
    expect(new Uint8Array(stored!).subarray(12, 40)).not.toEqual(upstream.segments[0]!.subarray(0, 28));

    const playlist = await (await respond(offlinePlaybackUrl(record))).text();
    expect(playlist).toContain(`#EXT-X-MAP:URI="/__offline__/${record.id}/r/0"`);
    expect(playlist).toContain(`#EXT-X-KEY:METHOD=AES-128,URI="/__offline__/${record.id}/r/1"`);
    expectSameBytes(await (await respond(`/__offline__/${record.id}/r/3`)).arrayBuffer(), upstream.segments[1]!);
    expect(await (await respond(`/__offline__/${record.id}/poster`)).text()).toBe('poster');
  });

  it('downloads a progressive file in chunks and serves byte ranges across chunk boundaries', async () => {
    const file = bytes(CHUNK_SIZE * 2 + 1234, 5);
    const { manager, respond, db } = setup(file, { hls: false });

    await manager.enqueue(target('104', 'mp4'));
    await manager.idle();

    const record = (await db.getDownload(downloadId('movie', '104')))!;
    expect(record).toMatchObject({ status: 'completed', format: 'file', totalParts: 3, totalBytes: file.length, mimeType: 'video/mp4' });

    const ranged = await respond(offlinePlaybackUrl(record), `bytes=${CHUNK_SIZE - 10}-${CHUNK_SIZE + 10}`);
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('Content-Range')).toBe(`bytes ${CHUNK_SIZE - 10}-${CHUNK_SIZE - 1}/${file.length}`);
    expectSameBytes(await ranged.arrayBuffer(), file.slice(CHUNK_SIZE - 10, CHUNK_SIZE));

    expectSameBytes(await (await respond(offlinePlaybackUrl(record))).arrayBuffer(), file);
    expect((await respond(offlinePlaybackUrl(record), `bytes=${file.length + 5}-`)).status).toBe(416);
  });

  it('handles servers that ignore Range', async () => {
    const file = bytes(CHUNK_SIZE + 50, 3);
    const { manager, respond, db } = setup(file, { hls: false, honorRange: false });

    await manager.enqueue(target('9', 'mp4'));
    await manager.idle();

    const record = (await db.getDownload(downloadId('movie', '9')))!;
    expect(record.totalParts).toBe(2);
    expectSameBytes(await (await respond(offlinePlaybackUrl(record))).arrayBuffer(), file);
  });

  it('refuses MKV without HLS and never serves incomplete downloads', async () => {
    const { manager, respond, db } = setup(bytes(10), { hls: false });

    await manager.enqueue(target('105', 'mkv'));
    await manager.idle();

    const record = (await db.getDownload(downloadId('movie', '105')))!;
    expect(record.status).toBe('error');
    expect(record.error).toMatch(/MKV files cannot play in a browser/);
    expect((await respond(`/__offline__/${record.id}/file`)).status).toBe(404);
  });

  it('resumes skipping stored parts, and remove deletes everything', async () => {
    const { manager, chunks, upstream, db } = setup();
    await manager.enqueue(target('101'));
    await manager.idle();
    const id = downloadId('movie', '101');
    await chunks.removeAll(id);
    await db.putDownload({ ...(await db.getDownload(id))!, status: 'paused', completedParts: 0 } satisfies DownloadRecord);
    const before = upstream.requests.length;

    await manager.resume(id);
    await manager.idle();
    expect((await db.getDownload(id))?.status).toBe('completed');
    expect(upstream.requests.length - before).toBeGreaterThan(5);

    await manager.remove(id);
    expect(await db.getDownload(id)).toBeNull();
    expect(await db.getKey(id)).toBeNull();
    expect(chunks.parts.size).toBe(0);
  });

  it('restore turns interrupted downloads into paused', async () => {
    const { manager, db } = setup();
    await db.putDownload({ id: 'movie-1', status: 'downloading' } as DownloadRecord);

    const records = await manager.restore();

    expect(records[0]!.status).toBe('paused');
  });
});
