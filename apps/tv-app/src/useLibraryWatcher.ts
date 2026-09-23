import { useEffect, useRef } from 'react';
import { isLibraryProcessing } from '@iptv/shared';
import { navStore, stores } from './appContext';
import { useLibrary, useSession } from './hooks';

const POLL_MS = 4000;

/**
 * Polls library status while it is empty or processing; when that ends, invalidates cached pages and bumps
 * `libraryRevision` so rows reload. Same rule as the web LibraryBanner (DECISIONS.md#d-025). Returns `processing`.
 */
export function useLibraryWatcher(): boolean {
  const offline = useSession((s) => s.offline);
  const statuses = useLibrary((s) => s.status.data);
  const syncing = useLibrary((s) => s.syncing);
  const processing = isLibraryProcessing(statuses) || syncing;
  const waiting = processing || !statuses || statuses.every((status) => status.masterCount === 0);
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
      navStore.getState().bumpLibrary();
    }
    wasWaiting.current = waiting;
  }, [waiting]);

  return processing;
}
