import type { Episode, ProgressDto } from '../api/types';

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
 * Providers give no intro markers and the backend does no processing. See DECISIONS.md#d-042.
 */
export const SKIP_AHEAD_WINDOW = { start: 5, end: 90, minDuration: 600 } as const;
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

/** Continue Watching row: unfinished items, one per series (latest episode), newest first. */
export function continueWatching(items: ProgressDto[], limit = 20): ProgressDto[] {
  const seen = new Set<string>();
  const result: ProgressDto[] = [];
  for (const item of [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const groupKey = item.kind === 'episode' && item.seriesId ? `series:${item.seriesId}` : `${item.kind}:${item.itemId}`;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);
    if (item.positionSeconds >= MIN_RESUME_SECONDS && !isCompleted(item.positionSeconds, item.durationSeconds)) {
      result.push(item);
    }
  }
  return result.slice(0, limit);
}

export function clampTime(seconds: number, durationSeconds: number): number {
  const max = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(0, seconds), max);
}

export interface SkipAheadWindow {
  start: number;
  end: number;
}

/** When the "Skip ahead" button shows: episodes of at least 10 minutes, 5–90 s in. Movies and live never. */
export function skipAheadWindow(kind: 'live' | 'movie' | 'episode', durationSeconds: number): SkipAheadWindow | null {
  if (kind !== 'episode' || !(durationSeconds >= SKIP_AHEAD_WINDOW.minDuration)) return null;
  return { start: SKIP_AHEAD_WINDOW.start, end: SKIP_AHEAD_WINDOW.end };
}

export const isInSkipAheadWindow = (window: SkipAheadWindow | null, time: number) => !!window && time >= window.start && time < window.end;

/** "30 s", "1 min", "2 min" … for the option buttons. */
export const skipAheadLabel = (seconds: number) => (seconds < 60 ? `${seconds} s` : `${seconds / 60} min`);

/** Spoken label: "Skip ahead 30 seconds", "Skip ahead 1 minute". */
export const skipAheadDescription = (seconds: number) =>
  seconds < 60 ? `Skip ahead ${seconds} seconds` : `Skip ahead ${seconds / 60} minute${seconds === 60 ? '' : 's'}`;

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

export function episodeLabel(episode: Pick<Episode, 'seasonNumber' | 'episodeNumber'>): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return episode.episodeNumber == null ? `S${pad(episode.seasonNumber)}` : `S${pad(episode.seasonNumber)}:E${pad(episode.episodeNumber)}`;
}
