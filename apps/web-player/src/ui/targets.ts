import { episodeLabel, type Episode, type MasterDetails, type ProgressDto, type VariantInfo } from '@iptv/shared';
import type { DownloadTarget } from '../offline/types';
import type { PlayTarget } from './uiStore';

export function movieTarget(master: MasterDetails, variant: VariantInfo): PlayTarget {
  return {
    kind: 'movie', streamId: variant.streamId, container: variant.containerExtension, title: master.title,
    subtitle: variant.label, posterUrl: master.posterUrl, masterId: master.id,
  };
}

export function episodeTarget(
  series: { title: string; masterId?: string | null; seriesId: string; posterUrl?: string | null },
  episode: Episode,
): PlayTarget {
  return {
    kind: 'episode', streamId: episode.id, container: episode.containerExtension, title: series.title,
    subtitle: `${episodeLabel(episode)} · ${episode.title}`, posterUrl: episode.stillUrl ?? series.posterUrl, masterId: series.masterId,
    seriesId: series.seriesId, seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber,
  };
}

export function progressTarget(progress: ProgressDto): PlayTarget {
  const isEpisode = progress.kind === 'episode';
  return {
    kind: isEpisode ? 'episode' : 'movie', streamId: progress.itemId, container: progress.containerExtension, title: progress.title,
    subtitle: isEpisode && progress.seasonNumber != null
      ? episodeLabel({ seasonNumber: progress.seasonNumber, episodeNumber: progress.episodeNumber })
      : null,
    posterUrl: progress.posterUrl, masterId: progress.masterId, seriesId: progress.seriesId,
    seasonNumber: progress.seasonNumber, episodeNumber: progress.episodeNumber, startAt: progress.positionSeconds,
  };
}

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
