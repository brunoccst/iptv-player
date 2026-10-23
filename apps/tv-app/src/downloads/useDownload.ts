import { downloadIdFor, type PlayTarget, t } from '@iptv/shared';
import type { TitleDownload } from '@iptv/screens';
import { downloadsStore } from '../appContext';
import { useDownloads } from '../hooks';
import { downloadTargetFrom, selectDownload } from './downloadsStore';

/** A title's download for the shared details' button and episode menu (D-078). Null when it cannot be downloaded. */
export function useDownload(target: PlayTarget): TitleDownload | null {
  const record = useDownloads((s) => (target.kind === 'live' ? null : selectDownload(s, target.kind, target.streamId)));
  const error = useDownloads((s) =>
    record ? null : (s.errors[downloadIdFor(target.kind as 'movie' | 'episode', target.streamId)] ?? null),
  );
  const downloadTarget = downloadTargetFrom(target);
  if (!downloadTarget) return null;

  const state = record?.state;
  const status: TitleDownload['status'] =
    state === 'completed' || state === 'downloading' || state === 'queued' || state === 'paused'
      ? state
      : state === 'failed' || error
        ? 'failed'
        : 'none';
  const percent = Math.round((record?.progress ?? 0) * 100);
  const label =
    status === 'completed'
      ? t('Downloaded')
      : status === 'downloading' || status === 'queued'
        ? t('Downloading {percent}%', { percent })
        : status === 'paused'
          ? t('Paused {percent}%', { percent })
          : status === 'failed'
            ? t('Download failed · Retry')
            : t('Download');

  const toggle = () => {
    const { start, pause, resume } = downloadsStore.getState();
    if (!record || state === 'failed') void start(downloadTarget);
    else if (state === 'downloading' || state === 'queued') pause(record.id);
    else if (state === 'paused') resume(record.id);
  };
  return {
    status,
    progress: record?.progress ?? 0,
    label: `${label}: ${target.title}`,
    menu: { status: status === 'queued' ? 'downloading' : status, percent },
    toggle,
  };
}
