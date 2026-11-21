import type { Episode, ProgressDto } from '../api/types';
import { t, tn } from '../i18n/i18n';

/** Seconds skipped by arrow keys (web) and D-pad taps (TV). */
export const SKIP_SECONDS = 10;
/** Next-episode overlay appears this many seconds before the end and counts down. */
export const NEXT_UP_COUNTDOWN_SECONDS = 10;
/** Progress under this is not worth a "Continue Watching" entry. */
export const MIN_RESUME_SECONDS = 30;
/** Watched when this share of the runtime is played or less than `COMPLETED_REMAINING_SECONDS` remain. */
export const COMPLETED_RATIO = 0.95;
export const COMPLETED_REMAINING_SECONDS = 120;

/**
 * "Skip ahead" button: shown early in episodes (where intros usually are), no intro detection.
 * Providers give no intro markers. See DECISIONS.md#d-042.
 */
export const SKIP_AHEAD_WINDOW = { start: 5, end: 15, minDuration: 600 } as const;
/** Choices the "Skip ahead" button expands into, in seconds. */
export const SKIP_AHEAD_OPTIONS = [30, 60, 120, 180] as const;

export function isCompleted(positionSeconds: number, durationSeconds: number): boolean {
  if (!(durationSeconds > 0)) return false;
  const remaining = durationSeconds - positionSeconds;
  return positionSeconds / durationSeconds >= COMPLETED_RATIO || (remaining <= COMPLETED_REMAINING_SECONDS && durationSeconds > 600);
}

/** Where playback should start: saved position, or 0 when finished/too early. */
export function resumePosition(progress: Pick<ProgressDto, 'positionSeconds' | 'durationSeconds'> | null | undefined): number {
  if (!progress || progress.positionSeconds < MIN_RESUME_SECONDS) return 0;
  return isCompleted(progress.positionSeconds, progress.durationSeconds) ? 0 : progress.positionSeconds;
}

/**
 * A Continue Watching place: a title in progress, or a series whose newest episode was finished (`upNext`), where the
 * row offers the episode after it (DECISIONS.md#d-245).
 */
export interface ContinueSlot {
  progress: ProgressDto;
  upNext: boolean;
}

/**
 * Continue Watching places, one per series (its newest episode) or movie, newest first. An entry under
 * `MIN_RESUME_SECONDS` (an episode opened for a moment, the next one started by the countdown) is passed over, so it
 * never hides the series' earlier episode (D-245). A finished movie leaves the row; a finished episode stays as `upNext`.
 */
export function continueWatchingSlots(items: ProgressDto[], limit = 20): ContinueSlot[] {
  const seen = new Set<string>();
  const result: ContinueSlot[] = [];
  for (const item of [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const finished = isCompleted(item.positionSeconds, item.durationSeconds);
    if (!finished && item.positionSeconds < MIN_RESUME_SECONDS) continue;
    const series = item.kind === 'episode' && !!item.seriesId;
    const groupKey = series ? `series:${item.seriesId}` : `${item.kind}:${item.itemId}`;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);
    if (!finished) result.push({ progress: item, upNext: false });
    else if (series) result.push({ progress: item, upNext: true });
  }
  return result.slice(0, limit);
}

/** Continue Watching titles in progress only (no next episodes), e.g. for the TV home screen's row. */
export function continueWatching(items: ProgressDto[], limit = 20): ProgressDto[] {
  return continueWatchingSlots(items, Number.POSITIVE_INFINITY)
    .filter((slot) => !slot.upNext)
    .slice(0, limit)
    .map((slot) => slot.progress);
}

/** The episode after `finishedId` in watch order that is not watched yet; null after the last one. */
export function upNextEpisode<E extends Episode>(
  series: { seasons: { number: number; episodes: E[] }[] },
  finishedId: string,
  isWatched: (episode: E) => boolean,
): E | null {
  const episodes = orderedEpisodes(series);
  const at = episodes.findIndex((episode) => episode.id === finishedId);
  return at < 0 ? null : (episodes.slice(at + 1).find((episode) => !isWatched(episode)) ?? null);
}

/**
 * What to delete so a Continue Watching entry leaves the row: for a series, every unfinished episode of it (else an
 * older unfinished episode would take its place); for a movie, its own progress. Finished episodes stay, so they keep
 * showing as watched.
 */
export function continueWatchingEntries(items: ProgressDto[], entry: ProgressDto): ProgressDto[] {
  const sameTitle = (item: ProgressDto) =>
    entry.kind === 'episode' && entry.seriesId
      ? item.kind === 'episode' && item.seriesId === entry.seriesId
      : item.kind === entry.kind && item.itemId === entry.itemId;
  return items.filter((item) => sameTitle(item) && !isCompleted(item.positionSeconds, item.durationSeconds));
}

export function clampTime(seconds: number, durationSeconds: number): number {
  const max = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(0, seconds), max);
}

export interface SkipAheadWindow {
  start: number;
  end: number;
}

/** When the "Skip ahead" button shows: episodes of at least 10 minutes, 5–15 s in (10 s on screen, D-042). Movies and live never. */
export function skipAheadWindow(kind: 'live' | 'movie' | 'episode', durationSeconds: number): SkipAheadWindow | null {
  if (kind !== 'episode' || !(durationSeconds >= SKIP_AHEAD_WINDOW.minDuration)) return null;
  return { start: SKIP_AHEAD_WINDOW.start, end: SKIP_AHEAD_WINDOW.end };
}

export const isInSkipAheadWindow = (window: SkipAheadWindow | null, time: number) => !!window && time >= window.start && time < window.end;

/** "30 s", "1 min", "2 min" … for the option buttons. */
export const skipAheadLabel = (seconds: number) =>
  seconds < 60 ? t('{seconds} s', { seconds }) : t('{minutes} min', { minutes: seconds / 60 });

/** Spoken label: "Skip ahead 30 seconds", "Skip ahead 1 minute". */
export const skipAheadDescription = (seconds: number) =>
  seconds < 60
    ? tn('Skip ahead {count} second', 'Skip ahead {count} seconds', seconds)
    : tn('Skip ahead {count} minute', 'Skip ahead {count} minutes', seconds / 60);

/** Seconds left on the next-up countdown, or null when the overlay should be hidden. */
export function nextUpCountdown(currentTime: number, durationSeconds: number, hasNext: boolean): number | null {
  if (!hasNext || !(durationSeconds > 0)) return null;
  const remaining = durationSeconds - currentTime;
  return remaining <= NEXT_UP_COUNTDOWN_SECONDS ? Math.max(0, Math.ceil(remaining)) : null;
}

/** Episodes in watch order: season, then episode number. */
export function orderedEpisodes<E extends Episode>(series: { seasons: { number: number; episodes: E[] }[] }): E[] {
  return [...series.seasons]
    .sort((a, b) => a.number - b.number)
    .flatMap((season) => [...season.episodes].sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)));
}

export function nextEpisode<E extends Episode>(
  series: { seasons: { number: number; episodes: E[] }[] },
  currentEpisodeId: string,
): E | null {
  const episodes = orderedEpisodes(series);
  const index = episodes.findIndex((episode) => episode.id === currentEpisodeId);
  return index >= 0 ? (episodes[index + 1] ?? null) : null;
}

/** The episode before this one in watch order (across seasons), for the player's "Previous episode" button. */
export function previousEpisode<E extends Episode>(
  series: { seasons: { number: number; episodes: E[] }[] },
  currentEpisodeId: string,
): E | null {
  const episodes = orderedEpisodes(series);
  const index = episodes.findIndex((episode) => episode.id === currentEpisodeId);
  return index > 0 ? (episodes[index - 1] ?? null) : null;
}

export function episodeLabel(episode: Pick<Episode, 'seasonNumber' | 'episodeNumber'>): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return episode.episodeNumber == null ? `S${pad(episode.seasonNumber)}` : `S${pad(episode.seasonNumber)}:E${pad(episode.episodeNumber)}`;
}
