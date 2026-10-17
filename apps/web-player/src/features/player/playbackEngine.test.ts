import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@iptv/shared';
import type { DownloadRecord } from '../../offline/types';
import type { StreamProbe } from '../../desktop';
import { conversionNeeded, PlaybackEngine, PlaybackUnavailableError, undecodableVideoCodec } from './playbackEngine';

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
          : this.handlers.get(Events.ERROR)?.(Events.ERROR, { fatal: true, type: 'net', details: 'manifestLoadError' }),
      );
    }
    attachMedia() {}
    destroy() {}
    startLoad() {}
    recoverMediaError() {}
  }
  return FakeHls;
}

/** Fake mpegts.js: URLs containing "good" fire loadedmetadata on the video, others raise a network error. */
function fakeMpegts() {
  const Events = { ERROR: 'error' };
  const ErrorTypes = { NETWORK_ERROR: 'NetworkError', MEDIA_ERROR: 'MediaError', OTHER_ERROR: 'OtherError' };
  const created: string[] = [];
  const module = {
    Events,
    ErrorTypes,
    isSupported: () => true,
    createPlayer: (source: { url: string }) => {
      created.push(source.url);
      let video: HTMLVideoElement | null = null;
      let onError: ((type: string, details: string, info?: { code?: number }) => void) | null = null;
      return {
        on: (_event: string, handler: typeof onError) => (onError = handler),
        attachMediaElement: (element: HTMLVideoElement) => (video = element),
        load: () =>
          queueMicrotask(() =>
            source.url.includes('good')
              ? video?.dispatchEvent(new Event('loadedmetadata'))
              : onError?.(ErrorTypes.NETWORK_ERROR, 'HttpStatusCodeInvalid', { code: 404 }),
          ),
        unload() {},
        play() {},
        destroy() {},
      };
    },
  };
  return { load: async () => module as never, created };
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
    const engine = new PlaybackEngine(
      fakeVideo(() => false),
      client,
      fakeHls() as never,
    );

    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mkv' }, null)).resolves.toEqual({
      url: 'http://r/good.m3u8',
      engine: 'hls',
      offline: false,
    });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original file when HLS fails', async () => {
    const { client } = api({ m3u8: 'http://r/bad.m3u8', mp4: 'http://r/movie.mp4' });
    const engine = new PlaybackEngine(
      fakeVideo((url) => url.endsWith('.mp4')),
      client,
      fakeHls() as never,
    );

    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, null)).resolves.toMatchObject({
      url: 'http://r/movie.mp4',
      engine: 'file',
    });
  });

  it("says the provider's server stopped sending the file mid-way (D-074)", async () => {
    const { client } = api({ m3u8: 'http://r/bad.m3u8', mp4: 'http://cdn.example/movie.mp4' });
    const video = fakeVideo((url) => url.endsWith('.mp4'));
    const engine = new PlaybackEngine(video, client, fakeHls() as never);
    const fatal = vi.fn();
    engine.onFatalError(fatal);
    await engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, null);

    (video as unknown as { error: { code: number } }).error = { code: 2 };
    video.dispatchEvent(new Event('error'));

    expect(fatal).toHaveBeenCalledWith(expect.stringMatching(/^Your IPTV provider's server \(cdn\.example\) stopped responding/), true);
  });

  it('explains MKV-only titles', async () => {
    const { client } = api({ mkv: 'http://r/movie.mkv' });
    const engine = new PlaybackEngine(
      fakeVideo(() => false),
      client,
      fakeHls() as never,
    );

    const error = await engine.load({ kind: 'movie', streamId: '1', container: 'mkv' }, null).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlaybackUnavailableError);
    expect((error as Error).message).toMatch(/only available as MKV.*TV app/);
    expect((error as PlaybackUnavailableError).unsupportedFormat).toBe(true);
  });

  it('does not blame MKV in the desktop app, which plays it: the provider is asked instead (issue #236)', async () => {
    const { client } = api({ mkv: 'http://r/movie.mkv' });
    const engine = new PlaybackEngine(
      fakeVideo(() => false),
      client,
      fakeHls() as never,
      true,
    );

    const error = await engine.load({ kind: 'movie', streamId: '1', container: 'mkv' }, null).catch((e: unknown) => e);

    expect((error as PlaybackUnavailableError).unsupportedFormat).toBe(false);
    expect((error as Error).message).toMatch(/couldn't be played/);
  });

  it('tries the stream server from the login reply when the portal address fails, like the TV app (D-088)', async () => {
    const get = vi.fn(async (_kind: string, _id: string, container?: string | null) => ({
      url: `http://portal/movie.${container}`,
      alternateUrls: [`http://streams/movie.${container}`],
      container: container ?? '',
      isLive: false,
      deliveryMode: 'direct',
    }));
    const engine = new PlaybackEngine(
      fakeVideo((url) => url.startsWith('http://streams/')),
      { playback: { get } } as unknown as ApiClient,
      fakeHls() as never,
    );

    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, null)).resolves.toMatchObject({
      url: 'http://streams/movie.mp4',
      engine: 'file',
    });
    expect(engine.attempted).toEqual([
      'http://portal/movie.m3u8',
      'http://streams/movie.m3u8',
      'http://portal/movie.mp4',
      'http://streams/movie.mp4',
    ]);
  });

  it('remembers the addresses it tried, so the player can ask the provider what it sent (D-074)', async () => {
    const { client } = api({ m3u8: 'http://r/bad.m3u8', mp4: 'http://r/bad.mp4' });
    const engine = new PlaybackEngine(
      fakeVideo(() => false),
      client,
      fakeHls() as never,
    );

    const error = await engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, null).catch((e: unknown) => e);

    expect((error as PlaybackUnavailableError).unsupportedFormat).toBe(false);
    expect(engine.attempted).toEqual(['http://r/bad.m3u8', 'http://r/bad.mp4']);
  });

  it('plays completed downloads without calling the API', async () => {
    const { client, get } = api({});
    const Hls = fakeHls();
    const engine = new PlaybackEngine(
      fakeVideo(() => true),
      client,
      Hls as never,
    );
    const record = { id: 'movie-1', status: 'completed', format: 'file' } as DownloadRecord;

    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, record)).resolves.toEqual({
      url: '/__offline__/movie-1/file',
      engine: 'file',
      offline: true,
    });
    expect(get).not.toHaveBeenCalled();
  });
});

describe('PlaybackEngine live MPEG-TS (issue #220)', () => {
  it('plays live MPEG-TS with mpegts.js when the panel has no HLS output', async () => {
    const { client } = api({ m3u8: 'http://r/bad.m3u8', ts: 'http://r/good.ts' });
    const mpegts = fakeMpegts();
    const engine = new PlaybackEngine(
      fakeVideo(() => false),
      client,
      fakeHls() as never,
      true,
      mpegts.load,
    );

    await expect(engine.load({ kind: 'live', streamId: '7', container: null }, null)).resolves.toEqual({
      url: 'http://r/good.ts',
      engine: 'mpegts',
      offline: false,
    });
    expect(mpegts.created).toEqual(['http://r/good.ts']);
  });

  it('uses mpegts.js straight away when the account only allows MPEG-TS, and does not ask twice', async () => {
    const get = vi.fn(async () => ({ url: 'http://r/live.ts', container: 'ts', isLive: true, deliveryMode: 'direct' }));
    const mpegts = fakeMpegts();
    const engine = new PlaybackEngine(
      fakeVideo(() => false),
      { playback: { get } } as unknown as ApiClient,
      fakeHls() as never,
      true,
      mpegts.load,
    );

    await expect(engine.load({ kind: 'live', streamId: '7', container: null }, null)).rejects.toBeInstanceOf(PlaybackUnavailableError);
    expect(mpegts.created).toEqual(['http://r/live.ts']);
    expect(engine.attempted).toEqual(['http://r/live.ts']);
  });
});

describe('undecodableVideoCodec (issue #236)', () => {
  const video = (supported: string[]) =>
    ({ canPlayType: (type: string) => (supported.some((s) => type.includes(s)) ? 'probably' : '') }) as never;

  it('names HEVC when this computer cannot decode it, and nothing when it can', () => {
    expect(undecodableVideoCodec(['hevc', 'eac3'], video([]))).toBe('HEVC (H.265)');
    expect(undecodableVideoCodec(['hevc', 'eac3'], video(['hvc1']))).toBeNull();
    expect(undecodableVideoCodec(['h264', 'ac3'], video([]))).toBeNull();
    expect(undecodableVideoCodec(['mpeg2'], video(['hvc1', 'mp4v']))).toBe('MPEG-2');
  });
});

describe('conversion by the desktop app (issue #236)', () => {
  const hevcAc3: StreamProbe = {
    duration: 3600,
    video: { codec: 'hevc', height: 2160, hdr: true },
    audio: [{ codec: 'ac3', language: 'eng' }],
  };
  const h264Ac3: StreamProbe = {
    duration: 3600,
    video: { codec: 'h264', height: 1080, hdr: false },
    audio: [{ codec: 'eac3', language: null }],
  };
  const decodes = (hevc: boolean) => ({ canPlayType: (type: string) => (hevc && type.includes('hvc1') ? 'probably' : '') }) as never;

  /** A fake bridge: `probes` by address; started conversions are recorded. */
  function bridge(probes: Record<string, StreamProbe>, fail = false) {
    const started: Record<string, unknown>[] = [];
    const transcode = {
      probe: vi.fn(async (url: string) => {
        if (!probes[url]) throw new Error('FFmpeg could not read the stream');
        return probes[url]!;
      }),
      start: vi.fn(async (options: Record<string, unknown>) => {
        if (fail) throw new Error('FFmpeg ended (1)');
        started.push(options);
        return { id: 'x', playlist: `/transcode/good${started.length}/index.m3u8`, duration: 3600, at: Math.floor(Number(options.at)) };
      }),
      stop: vi.fn(async () => undefined),
    };
    return { transcode, started };
  }

  /** The fake video with a clock, what is converted so far, and the decoded byte counters. */
  function clockVideo(playable: (url: string) => boolean) {
    const video = fakeVideo(playable) as HTMLVideoElement & Record<string, unknown>;
    Object.assign(video, {
      currentTime: 0,
      duration: 120,
      paused: false,
      play: vi.fn(async () => undefined),
      canPlayType: () => '',
      seekable: { length: 1, end: () => 120 },
      buffered: { length: 1, end: () => 60 },
    });
    return video;
  }

  it('knows what to convert', () => {
    expect(conversionNeeded(hevcAc3, decodes(false))).toBe('video');
    expect(conversionNeeded(hevcAc3, decodes(true))).toBe('audio');
    expect(conversionNeeded(h264Ac3, decodes(false))).toBe('audio');
    expect(conversionNeeded({ ...h264Ac3, audio: [{ codec: 'aac', language: null }] }, decodes(false))).toBe('none');
    expect(conversionNeeded({ duration: 10, video: { codec: 'mpeg4', height: 480, hdr: false }, audio: [] }, decodes(true))).toBe('video');
  });

  it('converts a title Chromium cannot play, from where it resumes, reading the file before HLS', async () => {
    const { client } = api({ m3u8: 'http://r/bad.m3u8', mkv: 'http://r/movie.mkv' });
    const { transcode, started } = bridge({ 'http://r/movie.mkv': hevcAc3 });
    const video = clockVideo(() => false);
    const engine = new PlaybackEngine(video, client, fakeHls() as never, true, fakeMpegts().load, transcode);

    const loaded = await engine.load({ kind: 'movie', streamId: '1', container: 'mkv' }, null, undefined, 1800.5);
    expect(loaded).toEqual({ url: '/transcode/good1/index.m3u8', engine: 'hls', offline: false, converted: { at: 1800, duration: 3600 } });
    expect(transcode.probe.mock.calls[0]).toEqual(['http://r/movie.mkv']);
    expect(started).toEqual([{ url: 'http://r/movie.mkv', probe: hevcAc3, at: 1800.5, live: false, copyVideo: false }]);

    // The title's clock: the conversion starts 1800 s in.
    video.currentTime = 30;
    expect(engine.position).toBe(1830);
    expect(engine.duration).toBe(3600);
    expect(engine.bufferedEnd).toBe(1860);
    // Within what is converted: the video moves; beyond it: the conversion starts again there.
    engine.seek(1900);
    expect(video.currentTime).toBe(100);
    const converted = vi.fn();
    engine.onConverted(converted);
    engine.seek(3000);
    await vi.waitFor(() => expect(converted).toHaveBeenCalled());
    expect(started[1]).toMatchObject({ at: 3000 });
    expect(converted.mock.calls[0]![0]).toMatchObject({ converted: { at: 3000 } });

    engine.destroy();
    expect(transcode.stop).toHaveBeenCalled();
  });

  it('says what it said before when the conversion fails too', async () => {
    const { client } = api({ mkv: 'http://r/movie.mkv' });
    const { transcode } = bridge({ 'http://r/movie.mkv': hevcAc3 }, true);
    const engine = new PlaybackEngine(
      clockVideo(() => false),
      client,
      fakeHls() as never,
      true,
      fakeMpegts().load,
      transcode,
    );
    await expect(engine.load({ kind: 'movie', streamId: '1', container: 'mkv' }, null)).rejects.toBeInstanceOf(PlaybackUnavailableError);
  });

  it('a video playing without sound gets its sound converted from where it is, the video copied', async () => {
    const { client } = api({ m3u8: 'http://r/bad.m3u8', mp4: 'http://r/movie.mp4' });
    const { transcode, started } = bridge({ 'http://r/movie.mp4': h264Ac3 });
    const video = clockVideo((url) => url.endsWith('.mp4'));
    const engine = new PlaybackEngine(video, client, fakeHls() as never, true, fakeMpegts().load, transcode);
    await engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, null);

    Object.assign(video, { webkitAudioDecodedByteCount: 5000, webkitVideoDecodedByteCount: 90000 });
    expect(engine.soundMissing()).toBe(false);
    Object.assign(video, { webkitAudioDecodedByteCount: 0, currentTime: 12.4 });
    expect(engine.soundMissing()).toBe(true);
    await expect(engine.convertHere()).resolves.toMatchObject({ converted: { at: 12 } });
    expect(started).toEqual([{ url: 'http://r/movie.mp4', probe: h264Ac3, at: 12.4, live: false, copyVideo: true }]);
    expect(engine.soundMissing()).toBe(false);
  });

  it('a video without sound that FFmpeg cannot read plays on as it was', async () => {
    const { client } = api({ mp4: 'http://r/movie.mp4' });
    const { transcode, started } = bridge({});
    const video = clockVideo((url) => url.endsWith('.mp4'));
    const engine = new PlaybackEngine(video, client, fakeHls() as never, true, fakeMpegts().load, transcode);
    await engine.load({ kind: 'movie', streamId: '1', container: 'mp4' }, null);
    video.currentTime = 40;
    await expect(engine.convertHere()).resolves.toBeNull();
    expect(started).toEqual([]);
    expect(video.src).toBe('http://r/movie.mp4');
    expect(video.currentTime).toBe(40);
  });
});
