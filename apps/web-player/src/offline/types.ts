/** Shared by page and Service Worker. Keep free of DOM-only and React imports. */
export const OFFLINE_PREFIX = '/__offline__/';
export const MEDIA_CACHE_NAME = 'offline-media-v1';
export const CHUNK_SIZE = 4 * 1024 * 1024;

export type DownloadKind = 'movie' | 'episode';
export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

/** What the UI asks to download. */
export interface DownloadTarget {
  kind: DownloadKind;
  streamId: string;
  container: string | null;
  title: string;
  subtitle?: string | null;
  posterUrl?: string | null;
  masterId?: string | null;
  seriesId?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  durationSeconds?: number | null;
}

/** Persisted in IndexedDB (`downloads` store). */
export interface DownloadRecord extends DownloadTarget {
  id: string;
  status: DownloadStatus;
  /** `hls`: parts are playlist resources. `file`: parts are CHUNK_SIZE byte ranges. */
  format: 'hls' | 'file' | null;
  /** Local HLS playlist whose URIs point to `/__offline__/{id}/r/{n}`. */
  playlist: string | null;
  totalParts: number;
  completedParts: number;
  totalBytes: number | null;
  bytesDownloaded: number;
  mimeType: string | null;
  createdAt: number;
  updatedAt: number;
  error: string | null;
}

// Same format as downloadIdFor in @iptv/shared; duplicated to keep the Service Worker bundle free of shared code.
export const downloadId = (kind: DownloadKind, streamId: string) => `${kind}-${streamId.replace(/[^\w-]/g, '_')}`;

export function downloadProgress(record: Pick<DownloadRecord, 'totalParts' | 'completedParts' | 'status'>): number {
  if (record.status === 'completed') return 1;
  return record.totalParts > 0 ? Math.min(1, record.completedParts / record.totalParts) : 0;
}

export function offlinePlaybackUrl(record: Pick<DownloadRecord, 'id' | 'format'>): string {
  return `${OFFLINE_PREFIX}${record.id}/${record.format === 'hls' ? 'index.m3u8' : 'file'}`;
}

export const partPath = (id: string, index: number) => `${OFFLINE_PREFIX}${id}/part/${index}`;
export const posterPath = (id: string) => `${OFFLINE_PREFIX}${id}/poster`;
