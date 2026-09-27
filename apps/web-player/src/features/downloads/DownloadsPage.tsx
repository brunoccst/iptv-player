import { formatOfflineDate, t, intlLocale } from '@iptv/shared';
import { downloadsStore, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { useDownloads, useOfflineAccess } from '../../hooks/stores';
import { downloadProgress, posterPath, type DownloadRecord } from '../../offline/types';
import { playTargetFromDownload } from '../../ui/targets';

const formatBytes = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toLocaleString(intlLocale(), { maximumFractionDigits: 1 })} GB`
    : `${Math.round(bytes / 1e6).toLocaleString(intlLocale())} MB`;

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
      <h1 className="page__title">{t('My Downloads')}</h1>
      {!supported ? <p className="muted">{t('This browser does not support offline downloads.')}</p> : null}
      {estimate ? (
        <p className="muted">
          {t('Using {used} of {available} available to this app.', {
            used: formatBytes(estimate.usage),
            available: formatBytes(estimate.quota),
          })}
        </p>
      ) : null}
      {supported && records.length === 0 ? <p className="muted">{t('Movies and episodes you download appear here.')}</p> : null}
      {records.length > 0 && !access.allowed ? (
        <p className="error-text" role="status">
          {access.message}
        </p>
      ) : records.length > 0 && access.allowed && access.recheckBy ? (
        <p className="muted">
          {t('Downloads play offline until {offlineDate}; opening the app online extends this.', {
            offlineDate: formatOfflineDate(access.recheckBy),
          })}
        </p>
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
              aria-label={t('Play {title}', { title: record.title })}
              onClick={() => uiStore.getState().play(playTargetFromDownload(record))}
            >
              <Icon name="play" size={20} />
            </button>
          ) : null
        ) : record.status === 'downloading' || record.status === 'queued' ? (
          <button
            type="button"
            className="icon-button"
            aria-label={t('Pause {title}', { title: record.title })}
            onClick={() => void pause(record.id)}
          >
            <Icon name="pause" size={20} />
          </button>
        ) : (
          <button
            type="button"
            className="icon-button"
            aria-label={t('Resume {title}', { title: record.title })}
            onClick={() => void resume(record.id)}
          >
            <Icon name="download" size={20} />
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={t('Delete {title}', { title: record.title })}
          onClick={() => void remove(record.id)}
        >
          <Icon name="trash" size={20} />
        </button>
      </div>
    </article>
  );
}
