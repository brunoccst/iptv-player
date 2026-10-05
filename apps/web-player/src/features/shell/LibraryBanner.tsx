import { useEffect, useRef } from 'react';
import { describeLibraryProgress, isLibraryProcessing, t } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/Spinner';
import { useLibrary, useSession } from '../../hooks/stores';

const POLL_MS = 4000;

/**
 * Offline notice, "organizing library" progress per kind, and empty-library hint; reloads rows when processing ends.
 * Floats at the bottom of Home and the Movies/Series pages, over the content, as in the TV/phone app (D-142).
 */
export function LibraryBanner() {
  const offline = useSession((s) => s.offline);
  const statuses = useLibrary((s) => s.status.data);
  const syncing = useLibrary((s) => s.syncing);
  const processing = isLibraryProcessing(statuses) || syncing;
  const progress = describeLibraryProgress(statuses);
  const empty = !statuses || statuses.every((status) => status.masterCount === 0);
  // Right after the first login the sync job may not exist yet: keep polling while empty, not only while processing.
  const waiting = processing || empty;
  // Rows shown while the status was still unknown (a start, D-120) are already the saved library's: only an update or
  // an empty library make them stale.
  const stale = processing || (!!statuses && empty);
  const wasStale = useRef(false);

  useEffect(() => {
    if (offline) return;
    void stores.library.getState().refreshStatus();
    if (!waiting) return;
    const timer = setInterval(() => void stores.library.getState().refreshStatus(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, offline]);

  useEffect(() => {
    if (wasStale.current && !stale) {
      stores.library.getState().invalidate();
      uiStore.getState().bumpLibrary();
    }
    wasStale.current = stale;
  }, [stale]);

  if (offline) {
    return (
      <div className="banner banner--floating" role="status">
        <Icon name="offline" /> {t("You're offline. Downloaded titles are available in My Downloads.")}
      </div>
    );
  }
  if (processing) {
    return (
      <div className="banner banner--floating banner--progress" role="status" data-testid="library-processing">
        <span className="banner__line">
          <Spinner small /> {t('Organizing your library: grouping duplicate titles and versions…')}
        </span>
        {progress.map((line) => (
          <span key={line} className="banner__detail">
            {line}
          </span>
        ))}
      </div>
    );
  }
  if (statuses && empty) {
    return (
      <div className="banner banner--floating" role="status">
        {t('Your library is empty. Is the title normalizer worker running?')}
        <button type="button" className="button button--secondary" onClick={() => void stores.library.getState().sync()}>
          {t('Refresh library')}
        </button>
      </div>
    );
  }
  return null;
}

/** How long the result of a refresh stays on screen. */
export const NOTICE_MS = 8000;

/** After a "Refresh library": what it did, e.g. "Your library is up to date…" (D-119). Floats at the bottom, any page. */
export function LibraryNotice() {
  const notice = useLibrary((s) => s.refreshNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => stores.library.getState().dismissRefreshNotice(), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div className="banner banner--notice" role="status" data-testid="library-notice">
      {notice}
      <button
        type="button"
        className="icon-button"
        aria-label={t('Close')}
        onClick={() => stores.library.getState().dismissRefreshNotice()}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
