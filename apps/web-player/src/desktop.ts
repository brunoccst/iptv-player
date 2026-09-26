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
}

export const desktop: DesktopBridge | undefined = (globalThis as { iptvDesktop?: DesktopBridge }).iptvDesktop;
