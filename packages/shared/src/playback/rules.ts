import type { Episode, ProgressDto, SeriesDetails } from '../api/types';

/** Seconds skipped by arrow keys (web) and D-pad taps (TV). */
export const SKIP_SECONDS = 10;
/** Next-episode overlay appears this many seconds before the end and counts down. */
export const NEXT_UP_COUNTDOWN_SECONDS = 10;
/** Progress under this is not worth a "Continue Watching" entry. */
export const MIN_RESUME_SECONDS = 30;
/** Watched when this share of the runtime is played or less than `COMPLETED_REMAINING_SECONDS` remain. */
export const COMPLETED_RATIO = 0.95;
export const COMPLETED_REMAINING_SECONDS = 120;

/** Heuristic intro window for episodes; providers give no markers. See DECISIONS.md#d-023. */
export const INTRO_WINDOW = { start: 5, end: 90, minDuration: 600 } as const;

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

export interface IntroWindow {
  start: number;
  end: number;
}

/** Intro window for an episode of at least 10 minutes, else null. Movies and live never get one. */
export function introWindow(kind: 'live' | 'movie' | 'episode', durationSeconds: number): IntroWindow | null {
  if (kind !== 'episode' || !(durationSeconds >= INTRO_WINDOW.minDuration)) return null;
  return { start: INTRO_WINDOW.start, end: INTRO_WINDOW.end };
}

export const isInIntro = (window: IntroWindow | null, time: number) => !!window && time >= window.start && time < window.end;

/** Seconds left on the next-up countdown, or null when the overlay should be hidden. */
export function nextUpCountdown(currentTime: number, durationSeconds: number, hasNext: boolean): number | null {
  if (!hasNext || !(durationSeconds > 0)) return null;
  const remaining = durationSeconds - currentTime;
  return remaining <= NEXT_UP_COUNTDOWN_SECONDS ? Math.max(0, Math.ceil(remaining)) : null;
}

/** Episodes in watch order: season, then episode number. */
export function orderedEpisodes(series: SeriesDetails): Episode[] {
  return [...series.seasons]
    .sort((a, b) => a.number - b.number)
    .flatMap((season) => [...season.episodes].sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)));
}

export function nextEpisode(series: SeriesDetails, currentEpisodeId: string): Episode | null {
  const episodes = orderedEpisodes(series);
  const index = episodes.findIndex((episode) => episode.id === currentEpisodeId);
  return index >= 0 ? (episodes[index + 1] ?? null) : null;
}

export function episodeLabel(episode: Pick<Episode, 'seasonNumber' | 'episodeNumber'>): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return episode.episodeNumber == null ? `S${pad(episode.seasonNumber)}` : `S${pad(episode.seasonNumber)}:E${pad(episode.episodeNumber)}`;
}
