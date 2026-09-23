import { downloadsStore } from '../appContext';
import { useDownloads } from '../hooks/stores';
import { selectDownload } from '../offline/downloadsStore';
import { downloadProgress, type DownloadTarget } from '../offline/types';
import { Icon } from './Icon';
import { ProgressRing } from './ProgressRing';

/** "Download for Offline" with a progress circle. Click toggles start/pause/resume. */
export function DownloadButton({ target }: { target: DownloadTarget }) {
  const supported = useDownloads((s) => s.supported);
  const record = useDownloads((s) => selectDownload(s, target.kind, target.streamId));
  if (!supported) return null;

  const { start, pause, resume } = downloadsStore.getState();
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

  const onClick = () => {
    if (!record || status === 'error') void start(target);
    else if (status === 'downloading' || status === 'queued') void pause(record.id);
    else if (status === 'paused') void resume(record.id);
  };

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
