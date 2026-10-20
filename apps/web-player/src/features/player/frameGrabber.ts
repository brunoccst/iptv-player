import Hls from 'hls.js';
import type { DesktopBridge } from '../../desktop';
import type { LoadedSource } from './playbackEngine';

/** What the timeline takes its hover pictures from. */
export interface FramePreview {
  /** Called with each picture asked for; draw it to a canvas. */
  onFrame(listener: (image: CanvasImageSource) => void): void;
  /** Asks for the picture at `time`; while one is on its way, only the latest request runs next. */
  request(time: number): void;
  destroy(): void;
}

/**
 * Hidden low-quality copy of the stream used to render timeline hover thumbnails.
 * Providers ship no trickplay sprites, so frames are decoded on demand. See DECISIONS.md#d-023.
 */
export class FrameGrabber implements FramePreview {
  private readonly video = document.createElement('video');
  private hls: Hls | null = null;
  private pendingTime: number | null = null;
  private seeking = false;
  private listener: ((video: HTMLVideoElement) => void) | null = null;

  constructor(source: LoadedSource) {
    this.video.muted = true;
    this.video.preload = 'auto';
    this.video.crossOrigin = 'anonymous';
    this.video.playsInline = true;
    this.video.addEventListener('seeked', this.onSeeked);
    this.video.addEventListener('loadedmetadata', this.onMetadata);

    if (source.engine === 'hls' && Hls.isSupported()) {
      this.hls = new Hls({ startLevel: 0, capLevelToPlayerSize: false, maxBufferLength: 4, maxMaxBufferLength: 8, enableWorker: true });
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (this.hls) this.hls.currentLevel = 0;
      });
      this.hls.loadSource(source.url);
      this.hls.attachMedia(this.video);
    } else {
      this.video.src = source.url;
    }
  }

  /** Called with the video element after each completed seek; draw it to a canvas. */
  onFrame(listener: (video: HTMLVideoElement) => void) {
    this.listener = listener;
  }

  /** Seeks to `time`. Requests during a seek are coalesced: only the latest one runs next. */
  request(time: number) {
    this.pendingTime = time;
    if (!this.seeking) this.seekNext();
  }

  destroy() {
    this.video.removeEventListener('seeked', this.onSeeked);
    this.video.removeEventListener('loadedmetadata', this.onMetadata);
    this.hls?.destroy();
    this.hls = null;
    this.video.removeAttribute('src');
    this.video.load();
  }

  private seekNext() {
    if (this.pendingTime === null) return;
    // A seek before metadata never fires `seeked` and would block every later request; wait for loadedmetadata.
    if (this.video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    this.seeking = true;
    this.video.currentTime = this.pendingTime;
    this.pendingTime = null;
  }

  private onMetadata = () => {
    if (!this.seeking) this.seekNext();
  };

  private onSeeked = () => {
    this.seeking = false;
    this.listener?.(this.video);
    this.seekNext();
  };
}

type FrameFn = NonNullable<NonNullable<DesktopBridge['transcode']>['frame']>;

/**
 * Timeline pictures of a title the desktop app converts (issue #270, DECISIONS.md#d-192): Chromium cannot decode that
 * stream itself, so the app's FFmpeg takes each picture from it and sends a JPEG.
 */
export class ConvertedFrames implements FramePreview {
  private listener: ((image: CanvasImageSource) => void) | null = null;
  private pendingTime: number | null = null;
  private busy = false;
  private destroyed = false;

  constructor(
    private readonly stream: { url: string; hdr: boolean },
    private readonly frame: FrameFn,
    private readonly decode: (jpeg: Uint8Array) => Promise<CanvasImageSource> = (jpeg) =>
      createImageBitmap(new Blob([jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' })),
  ) {}

  onFrame(listener: (image: CanvasImageSource) => void) {
    this.listener = listener;
  }

  request(time: number) {
    this.pendingTime = time;
    if (!this.busy) void this.next();
  }

  destroy() {
    this.destroyed = true;
    this.listener = null;
  }

  private async next() {
    if (this.pendingTime === null || this.destroyed) return;
    const at = this.pendingTime;
    this.pendingTime = null;
    this.busy = true;
    try {
      const jpeg = await this.frame({ url: this.stream.url, at, hdr: this.stream.hdr });
      if (jpeg && !this.destroyed) this.listener?.(await this.decode(jpeg));
    } catch {
      // No picture this time; the time label still shows.
    } finally {
      this.busy = false;
    }
    void this.next();
  }
}
