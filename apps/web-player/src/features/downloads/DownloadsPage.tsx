import { formatOfflineDate } from '@iptv/shared';
import { downloadsStore, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { useDownloads, useOfflineAccess } from '../../hooks/stores';
import { downloadProgress, posterPath, type DownloadRecord } from '../../offline/types';
import { playTargetFromDownload } from '../../ui/targets';

const formatBytes = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`);

/**
 * "My Downloads": encrypted in-app copies. Playable offline; never exposed as files. Play is hidden while downloads
 * are blocked (subscription expired or no online check for 30 days, D-050).
 */
export function DownloadsPage() {
  const access = useOfflineAccess();
  const supported = useDownloads((s) => s.supported);
  const records = useDownloads((s) => Object.values(s.records).sort((a, b) => b.createdAt - a.createdAt));
  const estimate = useDownloads((s) => s.estimate);

  return (
    <div className="page">
      <h1 className="page__title">My Downloads</h1>
      {!supported ? <p className="muted">This browser does not support offline downloads.</p> : null}
      {estimate ? (
        <p className="muted">
          Using {formatBytes(estimate.usage)} of {formatBytes(estimate.quota)} available to this app.
        </p>
      ) : null}
      {supported && records.length === 0 ? <p className="muted">Movies and episodes you download appear here.</p> : null}
      {records.length > 0 && !access.allowed ? (
        <p className="error-text" role="status">
          {access.message}
        </p>
      ) : records.length > 0 && access.allowed && access.recheckBy ? (
        <p className="muted">Downloads play offline until {formatOfflineDate(access.recheckBy)}; opening the app online extends this.</p>
      ) : null}
      <div className="downloads__list">
        {records.map((record) => (
          <DownloadItem key={record.id} record={record} playable={access.allowed} />
        ))}
      </div>
    </div>
  );
}

function DownloadItem({ record, playable }: { record: DownloadRecord; playable: boolean }) {
  const { pause, resume, remove } = downloadsStore.getState();
  const progress = downloadProgress(record);
  const statusText = {
    queued: 'Waiting…',
    downloading: `Downloading ${Math.round(progress * 100)}%`,
    paused: `Paused at ${Math.round(progress * 100)}%`,
    completed: `Downloaded · ${formatBytes(record.bytesDownloaded)}`,
    error: record.error ?? 'Failed',
  }[record.status];

  return (
    <article className="download-item" aria-label={record.title}>
      {record.posterUrl ? (
        <img src={posterPath(record.id)} alt="" onError={(e) => (e.currentTarget.src = record.posterUrl!)} />
      ) : (
        <span className="download-item__art" />
      )}
      <div>
        <p className="download-item__title">{record.title}</p>
        {record.subtitle ? (
          <p className="muted" style={{ margin: 0 }}>
            {record.subtitle}
          </p>
        ) : null}
        <p className={record.status === 'error' ? 'error-text' : 'muted'} style={{ margin: '6px 0 0' }}>
          {statusText}
        </p>
        {record.status !== 'completed' ? (
          <div className="download-item__bar">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
      </div>
      <div className="download-item__actions">
        {record.status === 'completed' ? (
          playable ? (
            <button
              type="button"
              className="icon-button"
              aria-label={`Play ${record.title}`}
              onClick={() => uiStore.getState().play(playTargetFromDownload(record))}
            >
              <Icon name="play" size={20} />
            </button>
          ) : null
        ) : record.status === 'downloading' || record.status === 'queued' ? (
          <button type="button" className="icon-button" aria-label={`Pause ${record.title}`} onClick={() => void pause(record.id)}>
            <Icon name="pause" size={20} />
          </button>
        ) : (
          <button type="button" className="icon-button" aria-label={`Resume ${record.title}`} onClick={() => void resume(record.id)}>
            <Icon name="download" size={20} />
          </button>
        )}
        <button type="button" className="icon-button" aria-label={`Delete ${record.title}`} onClick={() => void remove(record.id)}>
          <Icon name="trash" size={20} />
        </button>
      </div>
    </article>
  );
}
