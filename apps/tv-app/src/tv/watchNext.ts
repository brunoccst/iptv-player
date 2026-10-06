import { useEffect } from 'react';
import { continueWatching, isCompleted, MIN_RESUME_SECONDS, appLog, type ProgressDto } from '@iptv/shared';
import { createStore } from 'zustand/vanilla';
import { TvMedia, type WatchNextEntry, type WatchNextRow } from '../../modules/tv-media';
import { navStore, stores } from '../appContext';
import { playFromContinue } from '../navigation/navStore';

/** At most this many titles in the system row; Google TV shows only the newest few anyway (D-147). */
export const WATCH_NEXT_LIMIT = 10;
/** Saves arrive every few seconds while a title plays; the system row follows a little later (D-147). */
export const WATCH_NEXT_DELAY_MS = 10_000;

/** One system row entry per title: the profile, the kind and the item, so a click finds it again (D-147). */
export function watchNextId(profileId: string, entry: Pick<ProgressDto, 'kind' | 'itemId'>): string {
  return JSON.stringify([profileId, entry.kind, entry.itemId]);
}

export function parseWatchNextId(id: string): { profileId: string; kind: string; itemId: string } | null {
  try {
    const parsed: unknown = JSON.parse(id);
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((part) => typeof part === 'string')) {
      const [profileId, kind, itemId] = parsed as [string, string, string];
      return { profileId, kind, itemId };
    }
  } catch {
    // Not one of ours.
  }
  return null;
}

/** The active profile's Continue Watching, newest first, as the system row shows it (movies and episodes only). */
export function watchNextEntries(items: ProgressDto[], profileId: string): WatchNextEntry[] {
  return continueWatching(items, WATCH_NEXT_LIMIT)
    .filter((p) => (p.kind === 'movie' || p.kind === 'episode') && p.durationSeconds > 0)
    .map((p) => ({
      id: watchNextId(profileId, p),
      type: p.kind === 'episode' ? 'episode' : 'movie',
      title: p.title,
      season: p.kind === 'episode' ? p.seasonNumber : null,
      episode: p.kind === 'episode' ? p.episodeNumber : null,
      posterUrl: p.posterUrl?.trim() || null,
      positionMs: Math.round(p.positionSeconds * 1000),
      durationMs: Math.round(p.durationSeconds * 1000),
      lastEngagementMs: Date.parse(p.updatedAt) || 0,
    }));
}

export interface WatchNextPlan {
  insert: WatchNextEntry[];
  update: { rowId: number; entry: WatchNextEntry }[];
  remove: number[];
}

/**
 * What to change in the system row so it shows `entries`. A row the person removed on the home screen (no longer
 * browsable) stays removed until the title is watched again; then it comes back as a new row (D-147).
 */
export function watchNextPlan(entries: WatchNextEntry[], rows: WatchNextRow[]): WatchNextPlan {
  const wanted = new Map(entries.map((entry) => [entry.id, entry]));
  const plan: WatchNextPlan = { insert: [], update: [], remove: [] };
  const kept = new Set<string>();
  for (const row of rows) {
    const entry = row.id ? wanted.get(row.id) : undefined;
    if (!entry || kept.has(entry.id)) {
      plan.remove.push(row.rowId);
      continue;
    }
    kept.add(entry.id);
    if (!row.browsable) {
      if (row.lastEngagementMs >= entry.lastEngagementMs) continue;
      plan.remove.push(row.rowId);
      plan.insert.push(entry);
    } else if (row.lastEngagementMs !== entry.lastEngagementMs || row.positionMs !== entry.positionMs) {
      plan.update.push({ rowId: row.rowId, entry });
    }
  }
  for (const entry of entries) if (!kept.has(entry.id)) plan.insert.push(entry);
  return plan;
}

const isEmpty = (plan: WatchNextPlan) => !plan.insert.length && !plan.update.length && !plan.remove.length;

let syncing: Promise<void> = Promise.resolve();

/** Brings the system row in line with `entries`, one sync after the other. */
export function syncWatchNext(entries: WatchNextEntry[]): Promise<void> {
  syncing = syncing
    .then(async () => {
      const plan = watchNextPlan(entries, await TvMedia.watchNextRows());
      if (!isEmpty(plan)) await TvMedia.applyWatchNext(JSON.stringify(plan));
    })
    .catch((error: unknown) => appLog.warn('watch-next', `sync failed: ${error instanceof Error ? error.message : String(error)}`));
  return syncing;
}

/** What the system row should show now, or null while it is not known yet (starting, profile loading). */
function currentEntries(): WatchNextEntry[] | null {
  const { status, activeProfileId } = stores.session.getState();
  if (status === 'anonymous') return [];
  if (status !== 'authenticated') return null;
  // The profile picker: the last profile's titles leave the home screen (the row is not per profile).
  if (!activeProfileId) return [];
  const progress = stores.progress.getState();
  if (progress.profileId !== activeProfileId || progress.items.status !== 'success') return null;
  return watchNextEntries(progress.items.data ?? [], activeProfileId);
}

/** Android TV and Google TV: the active profile's Continue Watching in the home screen's "Continue watching" row (issue #165). */
export function useWatchNextSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = '';
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const entries = currentEntries();
        if (!entries) return;
        const key = JSON.stringify(entries);
        if (key === last) return;
        last = key;
        void syncWatchNext(entries);
      }, WATCH_NEXT_DELAY_MS);
    };
    schedule();
    const unsubscribeSession = stores.session.subscribe(schedule);
    const unsubscribeProgress = stores.progress.subscribe(schedule);
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribeSession();
      unsubscribeProgress();
    };
  }, [enabled]);
}

/** A title chosen in the home screen's row, waiting for its profile and progress to be ready. */
export const watchNextOpen = createStore<{ pending: string | null }>()(() => ({ pending: null }));

/** Takes the title the app was opened with from the home screen row, and the ones chosen while it runs. */
export function useWatchNextLaunch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const opened = TvMedia.takeWatchNextOpen();
    if (opened) watchNextOpen.setState({ pending: opened });
    const subscription = TvMedia.addListener('onWatchNextOpen', ({ id }) => watchNextOpen.setState({ pending: id }));
    return () => subscription.remove();
  }, [enabled]);
}

/**
 * Plays the chosen title once its profile is on and its progress loaded, like "Continue Watching" on Home (over its
 * details page). Another profile, or a title no longer in Continue Watching, only opens Home (D-147).
 */
export function openPendingWatchNext(): boolean {
  const { pending } = watchNextOpen.getState();
  if (!pending) return false;
  const { activeProfileId } = stores.session.getState();
  if (!activeProfileId) return false;
  const target = parseWatchNextId(pending);
  if (target?.profileId === activeProfileId) {
    const progress = stores.progress.getState();
    if (progress.profileId !== activeProfileId || progress.items.status === 'loading' || progress.items.status === 'idle') return false;
    const entry = progress.items.data?.find((p) => p.kind === target.kind && p.itemId === target.itemId);
    watchNextOpen.setState({ pending: null });
    navStore.getState().goSection('home');
    if (entry && entry.positionSeconds >= MIN_RESUME_SECONDS && !isCompleted(entry.positionSeconds, entry.durationSeconds)) {
      appLog.info('watch-next', `opened ${entry.kind} ${entry.itemId} from the home screen`);
      playFromContinue(navStore, entry);
    } else appLog.info('watch-next', 'the title chosen on the home screen is no longer in Continue Watching');
    return true;
  }
  watchNextOpen.setState({ pending: null });
  navStore.getState().goSection('home');
  return true;
}

/** Signed in with a profile: plays what was chosen on the home screen as soon as it can. */
export function useOpenWatchNext() {
  useEffect(() => {
    openPendingWatchNext();
    const run = () => void openPendingWatchNext();
    const unsubscribe = [watchNextOpen.subscribe(run), stores.progress.subscribe(run), stores.session.subscribe(run)];
    return () => unsubscribe.forEach((stop) => stop());
  }, []);
}
