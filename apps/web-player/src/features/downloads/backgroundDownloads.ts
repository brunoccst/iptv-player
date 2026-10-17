import { downloadsStore, uiStore } from '../../appContext';
import { desktop } from '../../desktop';
import type { DownloadsState } from '../../offline/downloadsStore';

/** Downloads that hold or wait for a provider connection. */
export const downloadsRunning = (state: Pick<DownloadsState, 'records'>) =>
  Object.values(state.records).some((record) => record.status === 'downloading' || record.status === 'queued');

/**
 * Desktop app (issue #219, DECISIONS.md#d-187): tells the main process whether downloads are running, so closing the
 * window hides it instead of stopping them; once hidden, playback stops. Returns the stop function.
 */
export function startBackgroundDownloads(): () => void {
  if (!desktop?.setDownloadsActive) return () => {};
  let active = false;
  const report = (state: DownloadsState) => {
    const now = downloadsRunning(state);
    if (now === active) return;
    active = now;
    void desktop!.setDownloadsActive!(now);
  };
  report(downloadsStore.getState());
  const unsubscribe = downloadsStore.subscribe(report);
  const unlisten = desktop.onBackground?.(() => {
    if (uiStore.getState().playing) uiStore.getState().stopPlayback();
  });
  return () => {
    unsubscribe();
    unlisten?.();
  };
}
