import { createStore } from 'zustand/vanilla';
import { downloadIdFor, toApiError, tvPlaybackAttempts, type ApiClient, type PlayTarget } from '@iptv/shared';
import type { NativeDownload, NativeDownloadState } from '../../modules/tv-media';

type TvMediaApi = typeof import('../../modules/tv-media').TvMedia;

/** Metadata stored with each native download (JSON in the Media3 DownloadRequest). */
export type DownloadTarget = Omit<PlayTarget, 'kind' | 'startAt'> & { kind: 'movie' | 'episode' };

export interface TvDownload {
  id: string;
  state: NativeDownloadState;
  /** 0..1 */
  progress: number;
  bytesDownloaded: number;
  target: DownloadTarget;
}

export interface DownloadsState {
  records: Record<string, TvDownload>;
  /** Start errors per id (e.g. provider unreachable). */
  errors: Record<string, string>;
  init(): void;
  start(target: DownloadTarget): Promise<void>;
  pause(id: string): void;
  resume(id: string): void;
  remove(id: string): void;
  refresh(): void;
  dispose(): void;
}

const POLL_MS = 1000;

function toRecord(download: NativeDownload): TvDownload | null {
  try {
    const target = JSON.parse(download.metadata) as DownloadTarget;
    const progress = download.state === 'completed' ? 1 : (download.percent ?? 0) / 100;
    return { id: download.id, state: download.state, progress, bytesDownloaded: download.bytesDownloaded, target };
  } catch {
    return null;
  }
}

/**
 * Bridges the native Media3 DownloadManager. Native events fire on state changes only, so progress is
 * polled every second while something downloads. See DECISIONS.md#d-029.
 */
/**
 * Original file first (ExoPlayer plays MKV/MP4/TS), panel HLS second. A 1-byte range request checks the file
 * exists before handing it to Media3, which would otherwise fail later in the background.
 */
async function resolveDownloadSource(api: ApiClient, target: DownloadTarget, fetchImpl: typeof fetch) {
  for (const attempt of tvPlaybackAttempts(target.kind, target.container)) {
    const playback = await api.playback.get(target.kind, target.streamId, attempt.container).catch(() => null);
    if (!playback) continue;
    const probe = await fetchImpl(playback.url, { headers: { Range: 'bytes=0-0' } }).catch(() => null);
    await probe?.body?.cancel?.().catch(() => undefined);
    if (probe?.ok) return { url: playback.url, isHls: attempt.engine === 'hls' };
  }
  throw new Error('This title is not available from the provider right now.');
}

export function createDownloadsStore({
  api,
  native,
  fetchImpl = (...args) => globalThis.fetch(...args),
}: {
  api: ApiClient;
  native: TvMediaApi;
  fetchImpl?: typeof fetch;
}) {
  let subscription: { remove(): void } | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;

  return createStore<DownloadsState>()((set, get) => {
    const apply = (downloads: NativeDownload[]) => {
      const records = Object.fromEntries(
        downloads
          .map(toRecord)
          .filter((r): r is TvDownload => r !== null)
          .map((r) => [r.id, r]),
      );
      set({ records });
      const active = Object.values(records).some((r) => r.state === 'downloading' || r.state === 'queued');
      if (active && !poll) poll = setInterval(() => get().refresh(), POLL_MS);
      if (!active && poll) {
        clearInterval(poll);
        poll = null;
      }
    };

    return {
      records: {},
      errors: {},
      init() {
        if (subscription) return;
        subscription = native.addListener('onDownloadsChanged', (event) => apply(event.downloads));
        get().refresh();
      },
      refresh: () => apply(native.listDownloads()),
      async start(target) {
        const id = downloadIdFor(target.kind, target.streamId);
        const { [id]: _, ...errors } = get().errors;
        set({ errors });
        try {
          const source = await resolveDownloadSource(api, target, fetchImpl);
          native.startDownload(id, source.url, source.isHls, JSON.stringify(target));
          get().refresh();
        } catch (error) {
          set({ errors: { ...get().errors, [id]: toApiError(error).message } });
        }
      },
      pause: (id) => {
        native.pauseDownload(id);
        get().refresh();
      },
      resume: (id) => {
        native.resumeDownload(id);
        get().refresh();
      },
      remove: (id) => {
        native.removeDownload(id);
        get().refresh();
      },
      dispose() {
        subscription?.remove();
        subscription = null;
        if (poll) clearInterval(poll);
        poll = null;
      },
    };
  });
}

export type DownloadsStore = ReturnType<typeof createDownloadsStore>;

export const selectDownload = (state: Pick<DownloadsState, 'records'>, kind: 'movie' | 'episode', streamId: string) =>
  state.records[downloadIdFor(kind, streamId)] ?? null;

export function downloadTargetFrom(target: PlayTarget): DownloadTarget | null {
  if (target.kind === 'live') return null;
  const { startAt: _, ...rest } = target;
  return { ...rest, kind: target.kind };
}
