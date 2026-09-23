import type { PlayTarget } from '@iptv/shared';
import type { DownloadTarget } from '../offline/types';

export { episodeTarget, movieTarget, progressTarget } from '@iptv/shared';

export function downloadTarget(target: PlayTarget, durationSeconds?: number | null): DownloadTarget {
  if (target.kind === 'live') throw new Error('Live channels cannot be downloaded.');
  return {
    kind: target.kind, streamId: target.streamId, container: target.container, title: target.title, subtitle: target.subtitle,
    posterUrl: target.posterUrl, masterId: target.masterId, seriesId: target.seriesId, seasonNumber: target.seasonNumber,
    episodeNumber: target.episodeNumber, durationSeconds,
  };
}

export function playTargetFromDownload(record: DownloadTarget): PlayTarget {
  return { ...record, kind: record.kind };
}
