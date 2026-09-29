import { useEffect, useRef } from 'react';
import { isLibraryProcessing } from '@iptv/shared';
import { navStore, stores } from './appContext';
import { useLibrary, useSession } from './hooks';

// Short enough that the per-kind progress on Home moves visibly.
const POLL_MS = 2000;

/**
 * Polls library status while it is unknown, empty or processing; when an update ends or an empty library fills,
 * invalidates cached pages and bumps `libraryRevision` so rows reload. Same rule as the web LibraryBanner (DECISIONS.md#d-025). Returns `processing`.
 */
export function useLibraryWatcher(): boolean {
  const offline = useSession((s) => s.offline);
  const statuses = useLibrary((s) => s.status.data);
  const syncing = useLibrary((s) => s.syncing);
  const processing = isLibraryProcessing(statuses) || syncing;
  const empty = !!statuses && statuses.every((status) => status.masterCount === 0);
  const waiting = processing || !statuses || empty;
  // Rows shown while the status was still unknown (a start, D-120) are already the saved library's: only an update or
  // an empty library make them stale.
  const stale = processing || empty;
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
      navStore.getState().bumpLibrary();
    }
    wasStale.current = stale;
  }, [stale]);

  return processing;
}
