import { progressDetails, progressTarget, type PlayTarget, type ProgressDto } from '@iptv/shared';
import type { DownloadTarget } from '../offline/types';
import type { UiStore } from './uiStore';

export { episodeTarget, movieTarget, progressTarget } from '@iptv/shared';

export function downloadTarget(target: PlayTarget, durationSeconds?: number | null): DownloadTarget {
  if (target.kind === 'live') throw new Error('Live channels cannot be downloaded.');
  return {
    kind: target.kind,
    streamId: target.streamId,
    container: target.container,
    title: target.title,
    subtitle: target.subtitle,
    posterUrl: target.posterUrl,
    masterId: target.masterId,
    seriesId: target.seriesId,
    seasonNumber: target.seasonNumber,
    episodeNumber: target.episodeNumber,
    durationSeconds,
  };
}

export function playTargetFromDownload(record: DownloadTarget): PlayTarget {
  return { ...record, kind: record.kind };
}

/** Plays a "Continue watching" entry over its details page, so Back from the player lands there (issue #166). */
export function playFromContinue(ui: UiStore, entry: ProgressDto) {
  const details = progressDetails(entry);
  if (details) ui.getState().openDetails(details);
  ui.getState().play(progressTarget(entry));
}
