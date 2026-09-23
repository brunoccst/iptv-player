import Hls, { type HlsConfig } from 'hls.js';
import { isBrowserNativeContainer, webPlaybackAttempts, type ApiClient, type PlaybackKind } from '@iptv/shared';
import { offlinePlaybackUrl, type DownloadRecord } from '../../offline/types';

export interface EngineSource {
  kind: PlaybackKind;
  streamId: string;
  container: string | null;
}

export interface LoadedSource {
  url: string;
  engine: 'hls' | 'file';
  offline: boolean;
}

export class PlaybackUnavailableError extends Error {}

type HlsFactory = Pick<typeof Hls, 'isSupported' | 'Events' | 'ErrorTypes'> & { new (config?: Partial<HlsConfig>): Hls };

const ATTACH_TIMEOUT_MS = 20_000;

/** Wraps one <video>: resolves stream URLs, tries HLS then file, recovers hls.js errors. See DECISIONS.md#d-023. */
export class PlaybackEngine {
  private hlsInstance: Hls | null = null;
  private onFatal: ((message: string) => void) | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly api: ApiClient,
    private readonly HlsClass: HlsFactory = Hls,
  ) {}

  get hls(): Hls | null {
    return this.hlsInstance;
  }

  /** Registers a callback for unrecoverable errors after a successful load. */
  onFatalError(callback: (message: string) => void) {
    this.onFatal = callback;
  }

  async load(source: EngineSource, offline: DownloadRecord | null, signal?: AbortSignal): Promise<LoadedSource> {
    if (offline?.status === 'completed') {
      const loaded: LoadedSource = { url: offlinePlaybackUrl(offline), engine: offline.format === 'hls' ? 'hls' : 'file', offline: true };
      await this.attach(loaded, signal);
      return loaded;
    }

    const failures: string[] = [];
    for (const attempt of webPlaybackAttempts(source.kind, source.container)) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const playback = await this.api.playback.get(source.kind, source.streamId, attempt.container, signal);
        const loaded: LoadedSource = { url: playback.url, engine: attempt.engine, offline: false };
        await this.attach(loaded, signal);
        return loaded;
      } catch (error) {
        if (signal?.aborted) throw error;
        failures.push(`${attempt.container}: ${error instanceof Error ? error.message : String(error)}`);
        this.detach();
      }
    }

    const container = (source.container ?? '').toUpperCase();
    throw new PlaybackUnavailableError(
      source.kind !== 'live' && source.container && !isBrowserNativeContainer(source.container)
        ? `This version is only available as ${container}, which web browsers can't play. Pick another version or watch it on the TV app.`
        : `This stream couldn't be played. The provider may be offline. (${failures.join('; ')})`,
    );
  }

  destroy() {
    this.detach();
    this.video.removeAttribute('src');
    this.video.load();
  }

  private detach() {
    this.hlsInstance?.destroy();
    this.hlsInstance = null;
  }

  private attach(source: LoadedSource, signal?: AbortSignal): Promise<void> {
    this.detach();
    if (source.engine === 'hls' && this.HlsClass.isSupported()) return this.attachHls(source.url, signal);
    // Safari plays HLS natively; everything else here is a progressive file.
    return this.attachNative(source.url, signal);
  }

  private attachHls(url: string, signal?: AbortSignal): Promise<void> {
    const hls = new this.HlsClass({ enableWorker: true, backBufferLength: 60, maxBufferLength: 30, xhrSetup: undefined });
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
          reject(new Error(`${data.type}: ${data.details}`));
          return;
        }
        // Standard hls.js recovery: retry network, recover media once or twice, then give up.
        if (data.type === this.HlsClass.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === this.HlsClass.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 2) hls.recoverMediaError();
        else this.onFatal?.(`Playback stopped (${data.details}).`);
      });

      hls.loadSource(url);
      hls.attachMedia(this.video);
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
        video.addEventListener('error', () => this.onFatal?.('Playback stopped (media error).'), { once: true });
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`Media error ${video.error?.code ?? ''}`.trim()));
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
