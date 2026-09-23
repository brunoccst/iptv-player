import type { PlaybackKind } from '../api/types';

/** Containers a desktop browser <video> can usually play without HLS. */
export const BROWSER_NATIVE_CONTAINERS = ['mp4', 'm4v', 'webm', 'mov'] as const;

export interface PlaybackAttempt {
  /** Passed to `/api/playback/...?container=`. */
  container: string;
  /** `hls` = hls.js / native HLS; `file` = progressive <video src>. */
  engine: 'hls' | 'file';
}

/**
 * Ordered attempts for the web player. VOD tries the panel's HLS output first (plays MKV sources in browsers),
 * then the original file. See DECISIONS.md#d-023.
 */
export function webPlaybackAttempts(kind: PlaybackKind, container: string | null | undefined): PlaybackAttempt[] {
  if (kind === 'live') return [{ container: 'm3u8', engine: 'hls' }];
  const original = (container ?? 'mp4').toLowerCase();
  return original === 'm3u8'
    ? [{ container: 'm3u8', engine: 'hls' }]
    : [{ container: 'm3u8', engine: 'hls' }, { container: original, engine: 'file' }];
}

export function isBrowserNativeContainer(container: string | null | undefined): boolean {
  return (BROWSER_NATIVE_CONTAINERS as readonly string[]).includes((container ?? '').toLowerCase());
}

export function mimeTypeForContainer(container: string): string {
  switch (container.toLowerCase()) {
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'mkv':
      return 'video/x-matroska';
    case 'm3u8':
      return 'application/vnd.apple.mpegurl';
    default:
      return 'video/mp4';
  }
}
