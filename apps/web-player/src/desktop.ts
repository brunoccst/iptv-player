import type { KeyValueStorage } from '@iptv/shared';

/**
 * What the desktop app (apps/desktop, D-071) adds to the page through its preload script. Absent in a browser.
 * `secure`: encrypted by the operating system (sign-in, provider password); `data`: files for the library the app
 * builds itself (too large for localStorage).
 */
export interface DesktopBridge {
  version: string;
  platform: string;
  /** Checks the desktop release; the app's own dialogs take it from there (D-073). */
  checkForUpdates(): Promise<void>;
  /** Plays a stream address in VLC with the provider User-Agent (D-081); 'none' when VLC is not installed. */
  openInVlc(url: string, title: string | null): Promise<'vlc' | 'none'>;
  /** The update dialogs' texts in the app's language, keyed by their English text (D-084). */
  setTexts(texts: Record<string, string>): Promise<void>;
  secure: KeyValueStorage;
  data: KeyValueStorage;
  /** The library database (D-121): statements and queries as JSON text, run by the main process. */
  db: { run(statements: string): Promise<void>; query(sql: string, params: string): Promise<string> };
  /** Phone-to-computer pairing (D-072): a server on the home network while the QR code is shown. */
  pairing: {
    /** `host` is null without a home network. `key`: 32 random bytes, base64. */
    start(): Promise<{ host: string | null; port: number; key: string }>;
    stop(): Promise<void>;
    respond(id: number, status: number, body: string): Promise<void>;
    /** Returns the unsubscribe function. */
    onRequest(listener: (request: { id: number; body: string }) => void): () => void;
  };
}

export const desktop: DesktopBridge | undefined = (globalThis as { iptvDesktop?: DesktopBridge }).iptvDesktop;
