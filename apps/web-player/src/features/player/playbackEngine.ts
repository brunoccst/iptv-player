import Hls, { type HlsConfig } from 'hls.js';
import type Mpegts from 'mpegts.js';
import {
  appLog,
  clampTime,
  errorMessage,
  isBrowserNativeContainer,
  webPlaybackAttempts,
  type ApiClient,
  type CatchupWindow,
  type PlaybackInfoWithAlternates,
  type PlaybackKind,
  providerUnreachableMessage,
  t,
  unreachableHost,
} from '@iptv/shared';
import { desktop, type DesktopBridge, type StreamProbe } from '../../desktop';
import { OFFLINE_PREFIX, offlinePlaybackUrl, type DownloadRecord } from '../../offline/types';

export interface EngineSource {
  kind: PlaybackKind;
  streamId: string;
  container: string | null;
  /** Live: a past programme from the provider's recordings (issue #226). */
  catchup?: CatchupWindow | null;
}

export interface LoadedSource {
  url: string;
  engine: 'hls' | 'file' | 'mpegts';
  offline: boolean;
  /**
   * Converted by the desktop app's FFmpeg (issue #236, DECISIONS.md#d-189): `url` is its playlist, which starts `at`
   * seconds into the title; `duration` is the title's (null for live).
   */
  converted?: { at: number; duration: number | null };
}

export class PlaybackUnavailableError extends Error {
  /** True when the browser cannot play the format at all (MKV …): asking the provider would not explain anything. */
  constructor(
    message: string,
    readonly unsupportedFormat = false,
  ) {
    super(message);
  }
}

/** Video codecs a probe can name, as `canPlayType` asks about them; mpeg2 has no browser decoder at all. */
const VIDEO_CODEC_TYPES: Record<string, { label: string; type: string | null }> = {
  hevc: { label: 'HEVC (H.265)', type: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
  mpeg4: { label: 'MPEG-4 (Xvid/DivX)', type: 'video/mp4; codecs="mp4v.20.9"' },
  mpeg2: { label: 'MPEG-2', type: null },
};

/** The first video codec in `codecs` this computer cannot decode (its display name), else null (issue #236). */
export function undecodableVideoCodec(codecs: string[], video: Pick<HTMLVideoElement, 'canPlayType'>): string | null {
  for (const codec of codecs) {
    const known = VIDEO_CODEC_TYPES[codec];
    if (known && (!known.type || video.canPlayType(known.type) === '')) return known.label;
  }
  return null;
}

/** Audio Chromium plays; other tracks (AC-3, E-AC-3, DTS, TrueHD…) play silently or not at all. */
const PLAYABLE_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac']);

/**
 * What the desktop app must convert for Chromium to play a stream (issue #236): nothing, only the sound (the video is
 * copied), or the video too.
 */
export function conversionNeeded(probe: StreamProbe, video: Pick<HTMLVideoElement, 'canPlayType'>): 'none' | 'audio' | 'video' {
  const codec = probe.video?.codec;
  const hevc = VIDEO_CODEC_TYPES.hevc!.type!;
  const videoPlays = !codec || codec === 'h264' || (codec === 'hevc' && video.canPlayType(hevc) !== '');
  if (!videoPlays) return 'video';
  return probe.audio.length === 0 || PLAYABLE_AUDIO.has(probe.audio[0]!.codec) ? 'none' : 'audio';
}

type Transcode = NonNullable<DesktopBridge['transcode']>;

type HlsFactory = Pick<typeof Hls, 'isSupported' | 'Events' | 'ErrorTypes'> & { new (config?: Partial<HlsConfig>): Hls };
export type MpegtsModule = Pick<typeof Mpegts, 'isSupported' | 'createPlayer' | 'Events' | 'ErrorTypes'>;

/** mpegts.js is only needed for panels without HLS output: load it on first use (issue #220). */
const loadMpegts = (): Promise<MpegtsModule> => import('mpegts.js').then((module) => module.default);
/** A live MPEG-TS stream that drops is reopened this many times before the player gives up. */
const MPEGTS_RECONNECTS = 3;

const ATTACH_TIMEOUT_MS = 20_000;
/** `MediaError.MEDIA_ERR_NETWORK`: the download stopped part way. */
const MEDIA_ERR_NETWORK = 2;

/** Wraps one <video>: resolves stream URLs, tries HLS then file, recovers hls.js errors. See DECISIONS.md#d-023. */
export class PlaybackEngine {
  private hlsInstance: Hls | null = null;
  private mpegtsPlayer: Mpegts.Player | null = null;
  private onFatal: ((message: string, network?: boolean) => void) | null = null;
  private onConvert: ((loaded: LoadedSource) => void) | null = null;
  private pickAudio: ((tracks: { language: string | null; label: string }[]) => number | null) | null = null;
  /** What plays now, and the provider address behind it (a download's own address for downloads). */
  private loaded: LoadedSource | null = null;
  private current: { url: string; live: boolean } | null = null;
  /**
   * The stream the desktop app converts (issue #236): a seek outside what is converted starts it again there, with the
   * audio track picked (`audio`, issue #270).
   */
  private conversion: { url: string; probe: StreamProbe; live: boolean; copyVideo: boolean; audio: number } | null = null;
  /** Stream addresses tried, last one last: what the provider sent there explains a failure (D-074, D-079). */
  readonly attempted: string[] = [];

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly api: ApiClient,
    private readonly HlsClass: HlsFactory = Hls,
    /** The desktop app's Chromium plays MKV (H.264/AAC), so there a failed MKV is a provider problem (issue #236). */
    private readonly playsMatroska = !!desktop,
    private readonly mpegts: () => Promise<MpegtsModule> = loadMpegts,
    /** The desktop app's FFmpeg (issue #236); absent in a browser and in older apps. */
    private readonly transcode: Transcode | undefined = desktop?.transcode,
  ) {}

  get hls(): Hls | null {
    return this.hlsInstance;
  }

  /** Position in the title, also when a conversion started part way into it (issue #236). */
  get position(): number {
    return (this.loaded?.converted?.at ?? 0) + this.video.currentTime;
  }

  /** The title's length; a conversion knows it before the converted part reaches the end. */
  get duration(): number {
    const converted = this.loaded?.converted;
    if (!converted) return this.video.duration;
    return converted.duration ?? converted.at + this.video.duration;
  }

  /** How far the title is loaded, as a position in the title. */
  get bufferedEnd(): number {
    const ranges = this.video.buffered;
    return ranges.length > 0 ? (this.loaded?.converted?.at ?? 0) + ranges.end(ranges.length - 1) : 0;
  }

  /** Moves to `seconds` into the title. A converted stream starts converting there when that part is not ready yet. */
  seek(seconds: number) {
    const target = clampTime(seconds, this.duration);
    const converted = this.loaded?.converted;
    if (!converted || !this.conversion) {
      this.video.currentTime = target;
      return;
    }
    const local = target - converted.at;
    const seekable = this.video.seekable;
    const ready = seekable.length > 0 ? seekable.end(seekable.length - 1) : 0;
    if (local >= 0 && local <= ready) {
      this.video.currentTime = local;
      return;
    }
    const playing = !this.video.paused;
    void this.startConversion(target).then(
      (loaded) => {
        this.onConvert?.(loaded);
        if (playing) void Promise.resolve(this.video.play()).catch(() => undefined);
      },
      (error: unknown) => this.onFatal?.(`Playback stopped (${errorMessage(error)}).`),
    );
  }

  /** What a converted title's timeline pictures are taken from (issue #270), else null. */
  get convertedStream(): { url: string; hdr: boolean } | null {
    if (!this.conversion || !this.loaded?.converted) return null;
    return { url: this.conversion.url, hdr: this.conversion.probe.video?.hdr ?? false };
  }

  /**
   * Which audio track a conversion starts with (issue #270): the profile's choice (D-087) among the stream's tracks,
   * named as the converted playlist names them; null for the first.
   */
  choosesAudio(pick: (tracks: { language: string | null; label: string }[]) => number | null) {
    this.pickAudio = pick;
  }

  /** Called when the engine switched to a converted stream by itself (issue #236): show it, and play. */
  onConverted(callback: (loaded: LoadedSource) => void) {
    this.onConvert = callback;
  }

  /**
   * Desktop: a video that plays without any decoded sound has audio Chromium cannot decode (AC-3, DTS…). Checked a few
   * seconds into playback (issue #236).
   */
  soundMissing(): boolean {
    const video = this.video as HTMLVideoElement & { webkitAudioDecodedByteCount?: number; webkitVideoDecodedByteCount?: number };
    return (
      !!this.transcode &&
      !this.conversion &&
      !!this.current &&
      video.webkitAudioDecodedByteCount === 0 &&
      !!video.webkitVideoDecodedByteCount
    );
  }

  /** Converts what plays now from where it is (issue #236); null when it needs no conversion or conversion failed. */
  convertHere(): Promise<LoadedSource | null> {
    if (!this.current || this.conversion) return Promise.resolve(null);
    return this.convert([this.current.url], this.current.live, this.position);
  }

  /**
   * Registers a callback for unrecoverable errors after a successful load; `network` when the provider's server stopped
   * sending the file (D-074).
   */
  onFatalError(callback: (message: string, network?: boolean) => void) {
    this.onFatal = callback;
  }

  /** `startAt`: where playback will start, where a conversion starts (issue #236). */
  async load(source: EngineSource, offline: DownloadRecord | null, signal?: AbortSignal, startAt = 0): Promise<LoadedSource> {
    if (offline?.status === 'completed') {
      const url = offlinePlaybackUrl(offline);
      const loaded: LoadedSource = { url, engine: offline.format === 'hls' ? 'hls' : 'file', offline: true };
      try {
        await this.attach(loaded, signal);
      } catch (error) {
        if (signal?.aborted || !this.transcode) throw error;
        // Desktop: a download Chromium cannot decode is converted too, read through this page (issue #270).
        const converted = await this.convert([url], false, startAt, signal);
        if (converted) return converted;
        throw error;
      }
      this.loaded = loaded;
      this.current = { url, live: false };
      return loaded;
    }
    const live = source.kind === 'live' && !source.catchup;

    const failures: string[] = [];
    for (const attempt of webPlaybackAttempts(source.kind, source.container)) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      let playback: PlaybackInfoWithAlternates;
      try {
        playback = await this.api.playback.get(source.kind, source.streamId, attempt.container, signal, { catchup: source.catchup });
      } catch (error) {
        if (signal?.aborted) throw error;
        failures.push(`${attempt.container}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      // An account whose allowed formats exclude HLS gets the MPEG-TS address even when HLS was asked for (issue #220).
      const engine = attempt.engine === 'hls' && playback.container === 'ts' ? 'mpegts' : attempt.engine;
      // Some panels answer the API on the portal and serve streams only on the stream server from the login reply:
      // that address is tried next, like the TV app (D-088).
      for (const url of [playback.url, ...(playback.alternateUrls ?? [])]) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (this.attempted.includes(url)) continue;
        try {
          const loaded: LoadedSource = { url, engine, offline: false };
          this.attempted.push(url);
          await this.attach(loaded, signal, !source.catchup);
          this.loaded = loaded;
          this.current = { url, live };
          return loaded;
        } catch (error) {
          if (signal?.aborted) throw error;
          const where = url === playback.url ? '' : ' (stream server)';
          failures.push(`${attempt.container}${where}: ${error instanceof Error ? error.message : String(error)}`);
          this.detach();
        }
      }
    }

    // Desktop: FFmpeg reads what Chromium could not, the provider's file first (issue #236).
    if (this.transcode && this.attempted.length > 0) {
      const files = [
        ...this.attempted.filter((url) => !/\.m3u8(\?|$)/.test(url)),
        ...this.attempted.filter((url) => /\.m3u8(\?|$)/.test(url)),
      ];
      const converted = await this.convert(files.slice(0, 2), live, startAt, signal);
      if (converted) return converted;
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    }

    const container = (source.container ?? '').toUpperCase();
    const playable = isBrowserNativeContainer(source.container) || (this.playsMatroska && container === 'MKV');
    const unsupported = source.kind !== 'live' && !!source.container && !playable;
    appLog.warn('player', `${source.kind} ${source.streamId} did not load: ${failures.join('; ')}`);
    throw new PlaybackUnavailableError(
      unsupported
        ? t(
            "This version is only available as {container}, which web browsers can't play. Pick another version or watch it on the TV app.",
            { container },
          )
        : `${t("This stream couldn't be played. The provider may be offline.")} (${failures.join('; ')})`,
      unsupported,
    );
  }

  destroy() {
    if (this.conversion) void this.transcode?.stop().catch(() => undefined);
    this.conversion = null;
    this.detach();
    this.video.removeAttribute('src');
    this.video.load();
  }

  /**
   * Converts the first of `urls` whose codecs Chromium lacks, from `at` seconds (issue #236). What plays is stopped
   * first, so a one-stream account has its stream free; when nothing is converted it plays again from where it was.
   */
  private async convert(urls: string[], live: boolean, at: number, signal?: AbortSignal): Promise<LoadedSource | null> {
    if (!this.transcode) return null;
    const before = this.loaded;
    if (before) {
      this.detach();
      this.video.removeAttribute('src');
      this.video.load();
    }
    for (const url of urls) {
      if (signal?.aborted) return null;
      try {
        const probe = await this.transcode.probe(url);
        const needed = conversionNeeded(probe, this.video);
        appLog.info(
          'player',
          `FFmpeg reads ${probe.video?.codec ?? 'no video'} / ${probe.audio.map((track) => track.codec).join(', ') || 'no audio'}: ${needed === 'none' ? 'nothing to convert' : `converting the ${needed}`}`,
        );
        if (needed === 'none') continue;
        const tracks = probe.audio.map((track, index) => ({ language: track.language, label: track.language ?? `Track ${index + 1}` }));
        const audio = this.pickAudio?.(tracks) ?? 0;
        this.conversion = { url, probe, live, copyVideo: needed === 'audio', audio: audio >= 0 ? audio : 0 };
        return await this.startConversion(at, signal);
      } catch (error) {
        this.conversion = null;
        if (signal?.aborted) return null;
        appLog.warn('player', `conversion failed: ${errorMessage(error)}`);
      }
    }
    if (before && !signal?.aborted) {
      await this.attach(before, signal, this.current?.live ?? true).catch(() => undefined);
      if (!before.offline) this.video.currentTime = at;
    }
    return null;
  }

  private async startConversion(at: number, signal?: AbortSignal): Promise<LoadedSource> {
    const conversion = this.conversion!;
    this.detach();
    const started = await this.transcode!.start({
      url: conversion.url,
      probe: conversion.probe,
      at: conversion.live ? 0 : at,
      live: conversion.live,
      copyVideo: conversion.copyVideo,
      audio: conversion.audio,
    });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const loaded: LoadedSource = {
      url: started.playlist,
      engine: 'hls',
      offline: conversion.url.startsWith(OFFLINE_PREFIX),
      converted: { at: started.at, duration: started.duration },
    };
    await this.attachHls(loaded.url, signal, !conversion.live);
    // Every audio track is converted (issue #270): the one picked stays picked when a seek converts again.
    this.hlsInstance?.on(this.HlsClass.Events.AUDIO_TRACK_SWITCHED, (_event, data) => {
      if (this.conversion === conversion) conversion.audio = data.id;
    });
    this.loaded = loaded;
    return loaded;
  }

  /** An error after playback started: a codec Chromium lacks is converted (issue #236), anything else is reported. */
  private fail(message: string, network = false) {
    if (network || !this.transcode || this.conversion || !this.current) {
      this.onFatal?.(message, network);
      return;
    }
    void this.convert([this.current.url], this.current.live, this.position).then((loaded) => {
      if (!loaded) return this.onFatal?.(message, network);
      this.onConvert?.(loaded);
      void Promise.resolve(this.video.play()).catch(() => undefined);
    });
  }

  private detach() {
    this.hlsInstance?.destroy();
    this.hlsInstance = null;
    this.mpegtsPlayer?.destroy();
    this.mpegtsPlayer = null;
  }

  private attach(source: LoadedSource, signal?: AbortSignal, live = true): Promise<void> {
    this.detach();
    if (source.engine === 'hls' && this.HlsClass.isSupported()) return this.attachHls(source.url, signal);
    if (source.engine === 'mpegts') return this.attachMpegts(source.url, live, signal);
    // Safari plays HLS natively; everything else here is a progressive file.
    return this.attachNative(source.url, signal);
  }

  /** `fromStart`: a conversion's growing playlist plays from its first segment, not from its end like live. */
  private attachHls(url: string, signal?: AbortSignal, fromStart = false): Promise<void> {
    const hls = new this.HlsClass({
      enableWorker: true,
      backBufferLength: 60,
      maxBufferLength: 30,
      xhrSetup: undefined,
      ...(fromStart ? { startPosition: 0 } : {}),
    });
    this.hlsInstance = hls;
    let loaded = false;
    let mediaRecoveries = 0;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out loading stream')), ATTACH_TIMEOUT_MS);
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });

      hls.on(this.HlsClass.Events.MANIFEST_PARSED, () => {
        loaded = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        resolve();
      });

      hls.on(this.HlsClass.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (!loaded) {
          clearTimeout(timer);
          // The HTTP status says whether the provider refused (403, 404) or nothing answered (0).
          const status = data.response ? ` (HTTP ${data.response.code})` : '';
          reject(new Error(`${data.type}: ${data.details}${status}`));
          return;
        }
        // Standard hls.js recovery: retry network, recover media once or twice, then give up.
        if (data.type === this.HlsClass.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === this.HlsClass.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 2) hls.recoverMediaError();
        else this.fail(`Playback stopped (${data.details}).`);
      });

      hls.loadSource(url);
      hls.attachMedia(this.video);
    });
  }

  /**
   * MPEG-TS for panels without HLS output: mpegts.js transmuxes it into the <video> (issue #220). A recording
   * (`live` false, catch-up) is a fixed-length file it can seek in.
   */
  private async attachMpegts(url: string, live: boolean, signal?: AbortSignal): Promise<void> {
    const mpegts = await this.mpegts();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!mpegts.isSupported()) throw new Error('MPEG-TS playback is not supported here');
    const video = this.video;
    const player = mpegts.createPlayer(
      { type: 'mpegts', isLive: live, url },
      {
        enableWorker: true,
        enableStashBuffer: true,
        liveBufferLatencyChasing: live,
        liveBufferLatencyMaxLatency: 8,
        liveBufferLatencyMinRemain: 2,
      },
    );
    this.mpegtsPlayer = player;
    let loaded = false;
    let reconnects = 0;

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener('loadedmetadata', onLoaded);
        signal?.removeEventListener('abort', onAbort);
      };
      const onLoaded = () => {
        loaded = true;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out loading stream'));
      }, ATTACH_TIMEOUT_MS);

      player.on(mpegts.Events.ERROR, (type: string, details: string, info?: { code?: number }) => {
        if (this.mpegtsPlayer !== player) return;
        if (!loaded) {
          cleanup();
          const status = info?.code ? ` (HTTP ${info.code})` : '';
          reject(new Error(`${type}: ${details}${status}`));
          return;
        }
        // A live connection that drops is reopened a few times, then the provider is named (D-074).
        if (type === mpegts.ErrorTypes.NETWORK_ERROR && live && reconnects++ < MPEGTS_RECONNECTS) {
          appLog.warn('player', `MPEG-TS stream dropped (${details}), reconnecting`);
          player.unload();
          player.load();
          void Promise.resolve(player.play()).catch(() => undefined);
        } else if (type === mpegts.ErrorTypes.NETWORK_ERROR) this.onFatal?.(providerUnreachableMessage(unreachableHost(url)), true);
        else this.fail(`Playback stopped (${details}).`);
      });
      video.addEventListener('loadedmetadata', onLoaded);
      signal?.addEventListener('abort', onAbort);
      player.attachMediaElement(video);
      player.load();
    });
  }

  private attachNative(url: string, signal?: AbortSignal): Promise<void> {
    const video = this.video;
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
        signal?.removeEventListener('abort', onAbort);
      };
      const onLoaded = () => {
        cleanup();
        video.addEventListener(
          'error',
          () => {
            // Mid-file, the provider's server stopped answering: say it is their side (D-074).
            if (video.error?.code === MEDIA_ERR_NETWORK) this.onFatal?.(providerUnreachableMessage(unreachableHost(url)), true);
            else this.fail('Playback stopped (media error).');
          },
          { once: true },
        );
        resolve();
      };
      const onError = () => {
        cleanup();
        // Chromium's text tells a refused or broken answer from a codec it cannot decode (issue #236).
        const detail = video.error?.message ? ` (${video.error.message})` : '';
        reject(new Error(`Media error ${video.error?.code ?? ''}`.trim() + detail));
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out loading file'));
      }, ATTACH_TIMEOUT_MS);

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
      signal?.addEventListener('abort', onAbort);
      video.src = url;
      video.load();
    });
  }
}
