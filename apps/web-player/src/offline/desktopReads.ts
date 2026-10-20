import type { DesktopBridge, OfflinePiece } from '../desktop';
import { OFFLINE_PREFIX } from './types';

/**
 * The desktop app converts a download Chromium cannot decode (issue #270, DECISIONS.md#d-192): its FFmpeg reads the
 * download through this page, whose Service Worker decrypts it (D-024). One piece per call: a file answers one stored
 * chunk from `start`, a playlist or HLS part comes whole. Only `/__offline__/` addresses.
 */
export async function readOfflinePiece(
  { path, start }: { path: string; start: number },
  fetchPiece: typeof fetch = fetch,
): Promise<OfflinePiece> {
  if (!path.startsWith(OFFLINE_PREFIX) || path.includes('..'))
    return { status: 404, contentType: null, total: null, data: new Uint8Array() };
  const answer = await fetchPiece(path, { headers: { Range: `bytes=${Math.max(0, Math.floor(start))}-` } });
  const contentType = answer.headers.get('Content-Type');
  if (!answer.ok) return { status: answer.status, contentType, total: null, data: new Uint8Array() };
  const total = /\/(\d+)$/.exec(answer.headers.get('Content-Range') ?? '')?.[1];
  return { status: answer.status, contentType, total: total ? Number(total) : null, data: new Uint8Array(await answer.arrayBuffer()) };
}

/** Answers the desktop app's download reads from now on (no-op in a browser and in older apps). */
export function serveOfflineReads(bridge: DesktopBridge | undefined): void {
  bridge?.transcode?.onOfflineRead?.((request) => readOfflinePiece(request));
}
