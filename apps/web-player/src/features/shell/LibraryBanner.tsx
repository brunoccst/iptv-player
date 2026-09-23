import { useEffect, useRef } from 'react';
import { isLibraryProcessing } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/Spinner';
import { useLibrary, useSession } from '../../hooks/stores';

const POLL_MS = 4000;

/** Offline notice, "organizing library" progress, and empty-library hint. Reloads rows when processing ends. */
export function LibraryBanner() {
  const offline = useSession((s) => s.offline);
  const statuses = useLibrary((s) => s.status.data);
  const syncing = useLibrary((s) => s.syncing);
  const processing = isLibraryProcessing(statuses) || syncing;
  const empty = !statuses || statuses.every((status) => status.masterCount === 0);
  // Right after the first login the sync job may not exist yet: keep polling while empty, not only while processing.
  const waiting = processing || empty;
  const wasWaiting = useRef(false);

  useEffect(() => {
    if (offline) return;
    void stores.library.getState().refreshStatus();
    if (!waiting) return;
    const timer = setInterval(() => void stores.library.getState().refreshStatus(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, offline]);

  useEffect(() => {
    if (wasWaiting.current && !waiting) {
      stores.library.getState().invalidate();
      uiStore.getState().bumpLibrary();
    }
    wasWaiting.current = waiting;
  }, [waiting]);

  if (offline) {
    return (
      <div className="banner" role="status">
        <Icon name="offline" /> You're offline. Downloaded titles are available in My Downloads.
      </div>
    );
  }
  if (processing) {
    return (
      <div className="banner" role="status">
        <Spinner small /> Organizing your library: grouping duplicate titles and versions…
      </div>
    );
  }
  if (statuses && empty) {
    return (
      <div className="banner" role="status">
        Your library is empty. Is the title normalizer worker running?
        <button type="button" className="button button--secondary" onClick={() => void stores.library.getState().sync()}>
          Refresh library
        </button>
      </div>
    );
  }
  return null;
}
