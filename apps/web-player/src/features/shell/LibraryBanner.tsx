import { useEffect, useRef } from 'react';
import { LibraryBanner as SharedLibraryBanner } from '@iptv/screens';
import { isLibraryProcessing } from '@iptv/shared';
import '../browse/screenHost';
import { stores, uiStore } from '../../appContext';
import { useLibrary, useSession } from '../../hooks/stores';

export { ConnectionBanner, LibraryNotice, NOTICE_MS } from '@iptv/screens';

const POLL_MS = 4000;

/**
 * Watches the library for the shared banner (DECISIONS.md#d-215): polls its status while it is organized or empty, and
 * reloads rows when processing ends. The banner floats at the bottom of Home and the Movies/Series pages (D-119).
 */
export function LibraryBanner() {
  const offline = useSession((s) => s.offline);
  const statuses = useLibrary((s) => s.status.data);
  const syncing = useLibrary((s) => s.syncing);
  const processing = isLibraryProcessing(statuses) || syncing;
  const empty = !statuses || statuses.every((status) => status.masterCount === 0);
  // Right after the first login the sync job may not exist yet: keep polling while empty, not only while processing.
  const waiting = processing || empty;
  // Rows shown while the status was still unknown (a start, D-121) are already the saved library's: only an update or
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
      // A better copy of a movie on My List is announced (DECISIONS.md#d-176).
      void stores.watchlist.getState().recheckQuality();
      // So is a new season of a watched series (DECISIONS.md#d-233).
      const profileId = stores.session.getState().activeProfileId;
      if (profileId) void stores.newSeasons.getState().check(profileId);
    }
    wasStale.current = stale;
  }, [stale]);

  return <SharedLibraryBanner processing={processing} onRefresh={statuses && empty ? () => void stores.library.getState().sync() : null} />;
}
