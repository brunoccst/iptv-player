import type { Episode, MasterDetails, PlaybackKind, ProgressDto, VariantInfo } from '../api/types';
import { episodeLabel } from './rules';

/** Everything a player needs to start, switch versions, save progress and find the next episode. */
export interface PlayTarget {
  kind: PlaybackKind;
  streamId: string;
  container: string | null;
  title: string;
  subtitle?: string | null;
  posterUrl?: string | null;
  masterId?: string | null;
  seriesId?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  /** Seconds to seek to after load. Undefined = use saved progress. */
  startAt?: number;
}

export function movieTarget(master: MasterDetails, variant: VariantInfo): PlayTarget {
  return {
    kind: 'movie',
    streamId: variant.streamId,
    container: variant.containerExtension,
    title: master.title,
    subtitle: variant.label,
    posterUrl: master.posterUrl,
    masterId: master.id,
  };
}

export function episodeTarget(
  series: { title: string; masterId?: string | null; seriesId: string; posterUrl?: string | null },
  episode: Episode,
): PlayTarget {
  return {
    kind: 'episode',
    streamId: episode.id,
    container: episode.containerExtension,
    title: series.title,
    subtitle: `${episodeLabel(episode)} · ${episode.title}`,
    posterUrl: episode.stillUrl ?? series.posterUrl,
    masterId: series.masterId,
    seriesId: series.seriesId,
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
  };
}

export function progressTarget(progress: ProgressDto): PlayTarget {
  const isEpisode = progress.kind === 'episode';
  return {
    kind: isEpisode ? 'episode' : 'movie',
    streamId: progress.itemId,
    container: progress.containerExtension,
    title: progress.title,
    subtitle:
      isEpisode && progress.seasonNumber != null
        ? episodeLabel({ seasonNumber: progress.seasonNumber, episodeNumber: progress.episodeNumber })
        : null,
    posterUrl: progress.posterUrl,
    masterId: progress.masterId,
    seriesId: progress.seriesId,
    seasonNumber: progress.seasonNumber,
    episodeNumber: progress.episodeNumber,
    startAt: progress.positionSeconds,
  };
}

/** Stable id shared by web and TV download stores. */
export const downloadIdFor = (kind: 'movie' | 'episode', streamId: string) => `${kind}-${streamId.replace(/[^\w-]/g, '_')}`;
