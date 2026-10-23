import { t, type PlayTarget } from '@iptv/shared';
import type { TitleDownload } from '@iptv/screens';
import { downloadsStore } from '../appContext';
import { useDownloads } from '../hooks/stores';
import { downloadTarget } from '../ui/targets';
import { selectDownload } from './downloadsStore';
import { downloadProgress } from './types';

/** A title's download for the shared details' button and episode menu (D-078). Null where downloads do not work. */
export function useDownload(playTarget: PlayTarget, durationSeconds?: number | null): TitleDownload | null {
  const target = downloadTarget(playTarget, durationSeconds);
  const supported = useDownloads((s) => s.supported);
  const record = useDownloads((s) => selectDownload(s, target.kind, target.streamId));
  if (!supported) return null;

  const status: TitleDownload['status'] = record?.status === 'error' ? 'failed' : (record?.status ?? 'none');
  const progress = record ? downloadProgress(record) : 0;
  const percent = Math.round(progress * 100);
  const label =
    status === 'completed'
      ? t('Downloaded: {title}', { title: target.title })
      : status === 'downloading' || status === 'queued'
        ? t('Pause download ({percent}%)', { percent })
        : status === 'paused'
          ? t('Resume download ({percent}%)', { percent })
          : status === 'failed'
            ? t('Download failed: {error}. Retry', { error: record?.error ?? '' })
            : t('Download {title} for offline', { title: target.title });

  const toggle = () => {
    const { start, pause, resume } = downloadsStore.getState();
    if (!record || status === 'failed') void start(target);
    else if (status === 'downloading' || status === 'queued') void pause(record.id);
    else if (status === 'paused') void resume(record.id);
  };
  return { status, progress, label, menu: { status: status === 'queued' ? 'downloading' : status, percent: progress * 100 }, toggle };
}
