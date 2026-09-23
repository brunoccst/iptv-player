import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@iptv/shared';
import type { DownloadRecord } from '../../offline/types';
import { PlaybackEngine, PlaybackUnavailableError } from './playbackEngine';

/** Minimal <video>: setting src fires loadedmetadata or error depending on `playable`. */
function fakeVideo(playable: (url: string) => boolean) {
  const target = new EventTarget() as EventTarget & { src: string; error: { code: number } | null; load(): void; removeAttribute(): void };
  let src = '';
  Object.defineProperty(target, 'src', {
    get: () => src,
    set: (value: string) => {
      src = value;
      queueMicrotask(() => target.dispatchEvent(new Event(playable(value) ? 'loadedmetadata' : 'error')));
    },
  });
  target.error = null;
  target.load = () => undefined;
  target.removeAttribute = () => undefined;
  return target as unknown as HTMLVideoElement;
}

/** Fake hls.js: manifests containing "good" parse, others raise a fatal error. */
function fakeHls() {
  const Events = { MANIFEST_PARSED: 'parsed', ERROR: 'error' };
  const ErrorTypes = { NETWORK_ERROR: 'net', MEDIA_ERROR: 'media' };
  class FakeHls {
    static Events = Events;
    static ErrorTypes = ErrorTypes;
    static isSupported = () => true;
    static loaded: string[] = [];
    private handlers = new Map<string, (event: string, data: unknown) => void>();
    on(event: string, handler: (event: string, data: unknown) => void) {
      this.handlers.set(event, handler);
    }
    loadSource(url: string) {
      FakeHls.loaded.push(url);
      queueMicrotask(() =>
        url.includes('good')
          ? this.handlers.get(Events.MANIFEST_PARSED)?.(Events.MANIFEST_PARSED, {})
          : this.handlers.get(Events.ERROR)?.(Events.ERROR, { fatal: true, type: 'net', details: 'manifestLoadError' }));
    }
    attachMedia() {}
    destroy() {}
    startLoad() {}
    recoverMediaError() {}
  }
  return FakeHls;
}

const api = (urls: Record<string, string>) => {
  const get = vi.fn(async (_kind: string, _id: string, container?: string | null) => {
    const url = urls[container ?? ''];
    if (!url) throw new Error('404');
    return { url, container: container ?? '', isLive: false, deliveryMode: 'relay' };
  });
  return { client: { playback: { get } } as unknown as ApiClient, get };
};

describe('PlaybackEngine', () => {
  it('prefers the panel HLS output for MKV sources', async () => {
    const { client, get } = api({ m3u8: 'http://r/good.m3u8', mkv: 'http://r/movie.mkv' });
    const engine = new PlaybackEngine(fakeVideo(() => false), client, fakeHls() as never);

    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mkv' }, null)).resolves.toEqual({
      url: 'http://r/good.m3u8', engine: 'hls', offline: false,
    });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original file when HLS fails', async () => {
    const { client } = api({ m3u8: 'http://r/bad.m3u8', mp4: 'http://r/movie.mp4' });
    const engine = new PlaybackEngine(fakeVideo((url) => url.endsWith('.mp4')), client, fakeHls() as never);

    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, null)).resolves.toMatchObject({
      url: 'http://r/movie.mp4', engine: 'file',
    });
  });

  it('explains MKV-only titles', async () => {
    const { client } = api({ mkv: 'http://r/movie.mkv' });
    const engine = new PlaybackEngine(fakeVideo(() => false), client, fakeHls() as never);

    const error = await engine.load({ kind: 'movie', streamId: '1', container: 'mkv' }, null).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlaybackUnavailableError);
    expect((error as Error).message).toMatch(/only available as MKV.*TV app/);
  });

  it('plays completed downloads without calling the API', async () => {
    const { client, get } = api({});
    const Hls = fakeHls();
    const engine = new PlaybackEngine(fakeVideo(() => true), client, Hls as never);
    const record = { id: 'movie-1', status: 'completed', format: 'file' } as DownloadRecord;

    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, record)).resolves.toEqual({
      url: '/__offline__/movie-1/file', engine: 'file', offline: true,
    });
    expect(get).not.toHaveBeenCalled();
  });
});
