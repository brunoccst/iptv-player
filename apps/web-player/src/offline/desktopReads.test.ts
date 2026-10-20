import { describe, expect, it, vi } from 'vitest';
import { readOfflinePiece, serveOfflineReads } from './desktopReads';

describe("the desktop app's FFmpeg reads downloads through the page (issue #270)", () => {
  it('asks the Service Worker from a byte and answers one piece with the whole size', async () => {
    const fetchPiece = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 206,
          headers: { 'Content-Range': 'bytes 10-12/500', 'Content-Type': 'video/mp4' },
        }),
    );
    const piece = await readOfflinePiece({ path: '/__offline__/movie-1/file', start: 10 }, fetchPiece as never);
    expect(fetchPiece).toHaveBeenCalledWith('/__offline__/movie-1/file', { headers: { Range: 'bytes=10-' } });
    expect(piece).toEqual({ status: 206, contentType: 'video/mp4', total: 500, data: new Uint8Array([1, 2, 3]) });
  });

  it('answers a playlist whole, and a missing download with its status', async () => {
    const playlist = vi.fn(async () => new Response('#EXTM3U', { status: 200 }));
    expect(await readOfflinePiece({ path: '/__offline__/episode-2/index.m3u8', start: 0 }, playlist as never)).toMatchObject({
      status: 200,
      total: null,
    });
    const missing = vi.fn(async () => new Response('Not downloaded', { status: 404 }));
    expect(await readOfflinePiece({ path: '/__offline__/x/file', start: 0 }, missing as never)).toMatchObject({
      status: 404,
      data: new Uint8Array(),
    });
  });

  it('reads nothing outside downloads', async () => {
    const fetchPiece = vi.fn();
    expect((await readOfflinePiece({ path: '/api/secret', start: 0 }, fetchPiece as never)).status).toBe(404);
    expect((await readOfflinePiece({ path: '/__offline__/../index.html', start: 0 }, fetchPiece as never)).status).toBe(404);
    expect(fetchPiece).not.toHaveBeenCalled();
  });

  it('listens only where the app can convert', () => {
    const onOfflineRead = vi.fn();
    serveOfflineReads({ transcode: { onOfflineRead } } as never);
    expect(onOfflineRead).toHaveBeenCalledTimes(1);
    expect(() => serveOfflineReads(undefined)).not.toThrow();
  });
});
