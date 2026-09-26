import type { ApiClient } from '../api/apiClient';
import type { Episode, MasterDetails, ProgressDto, Season, SeriesDetails } from '../api/types';
import { findProgress, type ProgressState } from '../stores/progressStore';
import type { Resource } from '../stores/resource';
import type { PlayTarget } from './targets';

/**
 * One episode list per series (D-066). A series title can have several versions ("EN - Show", "GE - Show 4K"); each
 * is its own series at the provider with its own seasons and episodes, and they are often incomplete in different
 * ways. The details page and the player load every version and merge the lists by season and episode number.
 */

/** One version of a series, in the title's version order (best first). */
export interface SeriesVersion {
  seriesId: string;
  /** Version label shown next to episodes ("ENG 4K"). */
  label: string;
  details: SeriesDetails;
}

/** The same episode in one version. */
export interface EpisodeVersion {
  seriesId: string;
  label: string;
  episode: Episode;
}

/**
 * An episode of the merged list. Its own fields (id, container, …) are those of the version it plays by default
 * (`seriesId`), so it can be passed wherever an `Episode` is expected; `versions` lists every version that has it,
 * the default first.
 */
export interface MergedEpisode extends Episode {
  seriesId: string;
  versions: EpisodeVersion[];
}

export interface MergedSeason extends Season {
  episodes: MergedEpisode[];
}

export interface MergedSeries extends SeriesDetails {
  seasons: MergedSeason[];
}

/** Versions loaded at once; the rest wait, so a title with ten versions does not send ten requests together. */
const PARALLEL_REQUESTS = 3;

/**
 * Loads the episode lists of these versions (best first). A version that fails to load is left out; only when all
 * fail does this fail, with the first version's error.
 */
export async function loadSeriesVersions(
  api: Pick<ApiClient, 'catalog'>,
  versions: { seriesId: string; label: string }[],
  signal?: AbortSignal,
): Promise<SeriesVersion[]> {
  const results: (SeriesVersion | { error: unknown })[] = new Array(versions.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < versions.length) {
      const index = nextIndex++;
      const version = versions[index]!;
      try {
        results[index] = { ...version, details: await api.catalog.seriesDetails(version.seriesId, signal) };
      } catch (error) {
        results[index] = { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, versions.length) }, worker));
  const loaded = results.filter((result): result is SeriesVersion => 'details' in result);
  if (loaded.length === 0 && results.length > 0) throw (results[0] as { error: unknown }).error;
  return loaded;
}

/**
 * Merges the versions' episode lists. Episodes match by season and episode number; episodes without a number cannot
 * be matched and stay separate. `preferredSeriesId` (the chosen version, or the one playing) plays by default where
 * it has the episode; otherwise the best version that has it does. Title, plot and picture come from the first
 * version that has them.
 */
export function mergeSeriesVersions(versions: SeriesVersion[], preferredSeriesId?: string | null): MergedSeries | null {
  const ordered = [...versions].sort((a, b) => Number(b.seriesId === preferredSeriesId) - Number(a.seriesId === preferredSeriesId));
  const main = ordered[0];
  if (!main) return null;

  const seasons = new Map<number, { season: Season; episodes: Map<string, EpisodeVersion[]> }>();
  for (const version of ordered) {
    for (const season of version.details.seasons) {
      let entry = seasons.get(season.number);
      if (!entry) seasons.set(season.number, (entry = { season, episodes: new Map() }));
      const seen = new Set<string>();
      for (const episode of season.episodes) {
        let key = episode.episodeNumber == null ? `id:${version.seriesId}:${episode.id}` : `e:${episode.episodeNumber}`;
        // The same number twice in one version (a provider mistake): keep both.
        if (seen.has(key)) key = `id:${version.seriesId}:${episode.id}`;
        seen.add(key);
        const list = entry.episodes.get(key) ?? [];
        list.push({ seriesId: version.seriesId, label: version.label, episode });
        entry.episodes.set(key, list);
      }
    }
  }

  const mergedSeasons = [...seasons.values()]
    .sort((a, b) => a.season.number - b.season.number)
    .map(({ season, episodes }) => ({
      ...season,
      coverUrl: season.coverUrl ?? null,
      episodes: [...episodes.values()].map(mergeEpisode).sort(byNumber),
    }));
  return {
    ...main.details,
    backdropUrls: ordered.find((v) => v.details.backdropUrls.length > 0)?.details.backdropUrls ?? [],
    cast: main.details.cast ?? ordered.find((v) => v.details.cast)?.details.cast ?? null,
    summary: {
      ...main.details.summary,
      plot: main.details.summary.plot ?? ordered.find((v) => v.details.summary.plot)?.details.summary.plot ?? null,
    },
    seasons: mergedSeasons,
  };
}

function mergeEpisode(versions: EpisodeVersion[]): MergedEpisode {
  const [first] = versions as [EpisodeVersion];
  const pick = <K extends 'plot' | 'stillUrl' | 'durationSeconds'>(key: K) =>
    first.episode[key] ?? versions.find((v) => v.episode[key] != null)?.episode[key] ?? null;
  return {
    ...first.episode,
    plot: pick('plot'),
    stillUrl: pick('stillUrl'),
    durationSeconds: pick('durationSeconds'),
    seriesId: first.seriesId,
    versions,
  };
}

// Same order as `orderedEpisodes`.
const byNumber = (a: MergedEpisode, b: MergedEpisode) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0);

/** The episode as it plays in one of its versions (the per-episode version choice). */
export function episodeInVersion(episode: MergedEpisode, seriesId: string | null | undefined): MergedEpisode {
  const version = episode.versions.find((v) => v.seriesId === seriesId);
  if (!version || version === episode.versions[0]) return episode;
  return { ...version.episode, seriesId: version.seriesId, versions: episode.versions };
}

/** Stream ids of every version of this episode, e.g. to find saved progress for any of them. */
export const episodeStreamIds = (episode: Episode | MergedEpisode): string[] =>
  'versions' in episode ? episode.versions.map((v) => v.episode.id) : [episode.id];

/** Saved progress of this episode in any of its versions. */
export function findEpisodeProgress(state: Pick<ProgressState, 'items'>, episode: Episode | MergedEpisode): ProgressDto | null {
  for (const id of episodeStreamIds(episode)) {
    const saved = findProgress(state, 'episode', id);
    if (saved) return saved;
  }
  return null;
}

/** The versions of a series title, best first, for `loadSeriesVersions`. */
export const seriesVersionsOf = (master: Pick<MasterDetails, 'variants'>) =>
  master.variants.map((variant) => ({ seriesId: variant.streamId, label: variant.label }));

/**
 * The versions a player loads for next-up and its episode list: all versions of the title once its details are
 * known (the playing one first by `mergeSeriesVersions`), only the playing one when there are none or they cannot
 * load. `null` while the details are still loading, so the lists are not loaded twice.
 */
export function playerSeriesVersions(
  target: Pick<PlayTarget, 'kind' | 'seriesId' | 'masterId'>,
  master: Resource<Pick<MasterDetails, 'variants'>> | undefined,
): { seriesId: string; label: string }[] | null {
  if (target.kind !== 'episode' || !target.seriesId) return null;
  const alone = [{ seriesId: target.seriesId, label: '' }];
  if (!target.masterId) return alone;
  if (master?.data) {
    const versions = seriesVersionsOf(master.data);
    return versions.some((v) => v.seriesId === target.seriesId) ? versions : alone;
  }
  return master?.status === 'error' ? alone : null;
}
