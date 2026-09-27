import type { DownloadMenuState } from '@iptv/shared';
import { downloadsStore } from '../appContext';
import { useDownloads } from '../hooks/stores';
import { selectDownload } from '../offline/downloadsStore';
import { downloadProgress, type DownloadTarget } from '../offline/types';
import { Icon } from './Icon';
import { ProgressRing } from './ProgressRing';

/** A title's download: its state, the button's label, and what selecting it does. Null where downloads do not work. */
export function useDownload(target: DownloadTarget) {
  const supported = useDownloads((s) => s.supported);
  const record = useDownloads((s) => selectDownload(s, target.kind, target.streamId));
  if (!supported) return null;

  const status = record?.status;
  const progress = record ? downloadProgress(record) : 0;

  const label =
    status === 'completed'
      ? `Downloaded: ${target.title}`
      : status === 'downloading' || status === 'queued'
        ? `Pause download (${Math.round(progress * 100)}%)`
        : status === 'paused'
          ? `Resume download (${Math.round(progress * 100)}%)`
          : status === 'error'
            ? `Download failed: ${record?.error ?? ''}. Retry`
            : `Download ${target.title} for offline`;
  /** For the episode menu (D-083). */
  const menu: DownloadMenuState = {
    status:
      status === 'completed'
        ? 'completed'
        : status === 'downloading' || status === 'queued'
          ? 'downloading'
          : status === 'paused'
            ? 'paused'
            : status === 'error'
              ? 'failed'
              : 'none',
    percent: progress * 100,
  };

  const toggle = () => {
    const { start, pause, resume } = downloadsStore.getState();
    if (!record || status === 'error') void start(target);
    else if (status === 'downloading' || status === 'queued') void pause(record.id);
    else if (status === 'paused') void resume(record.id);
  };
  return { status, progress, label, menu, toggle };
}

/** "Download for Offline" with a progress circle. Click toggles start/pause/resume. */
export function DownloadButton({ target }: { target: DownloadTarget }) {
  const download = useDownload(target);
  if (!download) return null;
  const { status, progress, label, toggle: onClick } = download;

  return (
    <button
      type="button"
      className={`download-button${status ? ` download-button--${status}` : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={status === 'completed'}
    >
      {status === 'downloading' || status === 'queued' || status === 'paused' ? <ProgressRing value={progress} /> : null}
      <Icon
        name={
          status === 'completed'
            ? 'check'
            : status === 'error'
              ? 'alert'
              : status === 'downloading' || status === 'queued'
                ? 'pause'
                : 'download'
        }
        size={status === 'downloading' || status === 'queued' || status === 'paused' ? 16 : 20}
      />
    </button>
  );
}
