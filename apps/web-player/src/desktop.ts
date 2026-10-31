import type { KeyValueStorage } from '@iptv/shared';

/**
 * What the desktop app (apps/desktop, D-071) adds to the page through its preload script. Absent in a browser.
 * `secure`: encrypted by the operating system (sign-in, provider password); `data`: files for the library the app
 * builds itself (too large for localStorage).
 */
export interface UpdateProgress {
  version: string;
  /** 0 to 100. */
  percent: number;
}

/** What the bundled FFmpeg read from a stream (issue #236): length (null for live), the first video, every audio track. */
export interface StreamProbe {
  duration: number | null;
  video: { codec: string; height: number | null; hdr: boolean } | null;
  audio: { codec: string; language: string | null }[];
  /** Every subtitle track; `text` when it can be shown converted (DECISIONS.md#d-236). Older apps lack it. */
  subtitles?: { codec: string; language: string | null; title: string | null; text: boolean }[];
}

/** A piece of a download for the app's FFmpeg (issue #270); `total` is null for what comes whole (a playlist, an HLS part). */
export interface OfflinePiece {
  status: number;
  contentType: string | null;
  total: number | null;
  data: Uint8Array;
}

export interface DesktopBridge {
  version: string;
  platform: string;
  /** Checks the desktop release; the app's own dialogs take it from there (D-073). */
  checkForUpdates(): Promise<void>;
  /** While an accepted update downloads: its version and percentage, then null. Returns the unsubscribe function. */
  onUpdateProgress?(listener: (progress: UpdateProgress | null) => void): () => void;
  /**
   * Plays a stream address in VLC with the provider User-Agent (D-057) from `startAt` seconds; 'none' when VLC is not
   * installed. With `watchId`, where VLC stops comes back through `onVlcProgress` (issue #265). Older apps ignore both.
   */
  openInVlc(url: string, title: string | null, startAt?: number, watchId?: string): Promise<'vlc' | 'none'>;
  /**
   * Where a watched VLC is (seconds): now and then while it plays, and `ended` when it closed. Returns the unsubscribe
   * function. Older apps lack it.
   */
  onVlcProgress?(listener: (progress: { id: string; position: number; duration: number; ended: boolean }) => void): () => void;
  /** The update dialogs' texts in the app's language, keyed by their English text (D-084). */
  setTexts(texts: Record<string, string>): Promise<void>;
  /**
   * Whether downloads are running (issue #219): closing the window then hides it and the downloads go on, with a tray
   * icon; the app quits when they end. Older apps lack it.
   */
  setDownloadsActive?(active: boolean): Promise<void>;
  /** The window was closed and hidden while downloads run: stop playing. Returns the unsubscribe function. */
  onBackground?(listener: () => void): () => void;
  /**
   * Start with the computer (issue #309): the app starts hidden in the tray at sign-in, and closing the window keeps it
   * there, so guide reminders still show. `set` returns the new state. Older apps lack it.
   */
  startup?: { get(): Promise<boolean>; set(on: boolean): Promise<boolean> };
  /** Brings the window back, from the tray too. Older apps lack it. */
  show?(): Promise<void>;
  /**
   * Plays what Chromium cannot decode (issue #236): the app converts the stream with its FFmpeg into an HLS playlist on
   * its own server, starting at `at` seconds; one at a time. Older apps lack it.
   */
  transcode?: {
    probe(url: string): Promise<StreamProbe>;
    start(options: { url: string; probe?: StreamProbe; at?: number; live?: boolean; copyVideo?: boolean; audio?: number }): Promise<{
      id: string;
      playlist: string;
      duration: number | null;
      at: number;
      /** The H.264 encoder used (issue #274): libx264, or a hardware one. Older apps lack it; null when the video is copied. */
      encoder?: string | null;
    }>;
    stop(): Promise<void>;
    /** A timeline picture of a converted title at `at` seconds (issue #270): JPEG bytes, or null. Older apps lack it. */
    frame?(options: { url: string; at: number; hdr?: boolean }): Promise<Uint8Array | null>;
    /**
     * Converting a download (issue #270): the app asks the page for a piece of `path` (a `/__offline__/` address) from
     * byte `start`, read through the Service Worker. Returns the unsubscribe function. Older apps lack it.
     */
    onOfflineRead?(listener: (request: { path: string; start: number }) => Promise<OfflinePiece>): () => void;
  };
  secure: KeyValueStorage;
  data: KeyValueStorage;
  /** The library database (D-121): statements and queries as JSON text, run by the main process. */
  db: { run(statements: string): Promise<void>; query(sql: string, params: string): Promise<string> };
  /** Phone-to-computer pairing (D-060): a server on the home network while the QR code is shown. */
  pairing: {
    /** `host` is null without a home network. `key`: 32 random bytes, base64. */
    start(): Promise<{ host: string | null; port: number; key: string }>;
    stop(): Promise<void>;
    respond(id: number, status: number, body: string): Promise<void>;
    /** Returns the unsubscribe function. */
    onRequest(listener: (request: { id: number; body: string }) => void): () => void;
    /**
     * Sends a scanned code's pairing request to that device (issue #254), or a sync to the paired TV (`path` '/remote',
     * issue #227); only to home network addresses. Older apps lack it.
     */
    send?(host: string, port: number, body: string, path?: '/pair' | '/remote'): Promise<{ status: number; body: string }>;
  };
  /**
   * The computer as a sync hub (issue #268, DECISIONS.md#d-240): a server on the home network, on a port of the TV's
   * range, for phones that scanned this computer's code. `name`: the computer's name. Older apps lack it.
   */
  remote?: {
    start(): Promise<{ port: number; name: string }>;
    stop(): Promise<void>;
    respond(id: number, status: number, body: string): Promise<void>;
    /** Returns the unsubscribe function. */
    onRequest(listener: (request: { id: number; body: string }) => void): () => void;
  };
}

export const desktop: DesktopBridge | undefined = (globalThis as { iptvDesktop?: DesktopBridge }).iptvDesktop;
