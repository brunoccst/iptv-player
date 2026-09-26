import type { KeyValueStorage } from '@iptv/shared';

/**
 * What the desktop app (apps/desktop, D-071) adds to the page through its preload script. Absent in a browser.
 * `secure`: encrypted by the operating system (sign-in, provider password); `data`: files for the library the app
 * builds itself (too large for localStorage).
 */
export interface DesktopBridge {
  version: string;
  platform: string;
  secure: KeyValueStorage;
  data: KeyValueStorage;
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
