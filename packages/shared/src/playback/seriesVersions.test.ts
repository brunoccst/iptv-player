import { describe, expect, it } from 'vitest';
import type { Episode, SeriesDetails } from '../api/types';
import { nextEpisode, orderedEpisodes } from './rules';
import {
  episodeInVersion,
  findEpisodeProgress,
  loadSeriesVersions,
  mergeSeriesVersions,
  type MergedEpisode,
  type SeriesVersion,
} from './seriesVersions';

const episode = (id: string, seasonNumber: number, episodeNumber: number | null, extra: Partial<Episode> = {}): Episode => ({
  id,
  seasonNumber,
  episodeNumber,
  title: `Episode ${episodeNumber ?? '?'}`,
  plot: null,
  stillUrl: null,
  durationSeconds: null,
  containerExtension: 'mkv',
  ...extra,
});

const details = (id: string, seasons: Record<number, Episode[]>, extra: Partial<SeriesDetails> = {}): SeriesDetails => ({
  summary: {
    id,
    name: `Show ${id}`,
    categoryId: null,
    genre: null,
    lastModifiedAt: null,
    plot: null,
    posterUrl: null,
    rating: null,
    releaseDate: null,
    tmdbId: null,
  },
  backdropUrls: [],
  cast: null,
  director: null,
  trailerYoutubeId: null,
  seasons: Object.entries(seasons).map(([number, episodes]) => ({
    number: Number(number),
    name: `Season ${number}`,
    coverUrl: null,
    episodes,
  })),
  ...extra,
});

// "EN 4K" (best) has season 1 without episode 2 and season 2; "GE" has all of season 1 only.
const en: SeriesVersion = {
  seriesId: 'en',
  label: 'ENG 4K',
  details: details(
    'en',
    { 1: [episode('en-1', 1, 1, { plot: 'Pilot' }), episode('en-3', 1, 3)], 2: [episode('en-4', 2, 1)] },
    { cast: 'A, B' },
  ),
};
const ge: SeriesVersion = {
  seriesId: 'ge',
  label: 'GER',
  details: details('ge', { 1: [episode('ge-1', 1, 1, { stillUrl: 'http://img/1.jpg' }), episode('ge-2', 1, 2), episode('ge-3', 1, 3)] }),
};
const ids = (list: MergedEpisode[]) => list.map((e) => `${e.id}[${e.versions.map((v) => v.label).join(',')}]`);

describe('one episode list per series (D-066)', () => {
  it('merges seasons and episodes of all versions; the best version plays where it has the episode', () => {
    const merged = mergeSeriesVersions([en, ge])!;
    expect(merged.seasons.map((s) => s.number)).toEqual([1, 2]);
    expect(ids(merged.seasons[0]!.episodes)).toEqual(['en-1[ENG 4K,GER]', 'ge-2[GER]', 'en-3[ENG 4K,GER]']);
    expect(ids(merged.seasons[1]!.episodes)).toEqual(['en-4[ENG 4K]']);
    // Text and pictures come from whichever version has them.
    expect(merged.seasons[0]!.episodes[0]).toMatchObject({ plot: 'Pilot', stillUrl: 'http://img/1.jpg', seriesId: 'en' });
    expect(merged.cast).toBe('A, B');
    // Watch order runs across versions: after S1E1 (EN) comes S1E2 from the German version.
    expect(nextEpisode(merged, 'en-1')).toMatchObject({ id: 'ge-2', seriesId: 'ge' });
    expect(orderedEpisodes(merged).map((e) => e.id)).toEqual(['en-1', 'ge-2', 'en-3', 'en-4']);
  });

  it('the chosen (or playing) version plays by default where it has the episode', () => {
    const merged = mergeSeriesVersions([en, ge], 'ge')!;
    expect(ids(merged.seasons[0]!.episodes)).toEqual(['ge-1[GER,ENG 4K]', 'ge-2[GER]', 'ge-3[GER,ENG 4K]']);
    expect(merged.seasons[1]!.episodes[0]).toMatchObject({ id: 'en-4', seriesId: 'en' });
    // The player finds the next episode from the one playing.
    expect(nextEpisode(merged, 'ge-3')).toMatchObject({ id: 'en-4' });
  });

  it('each episode can play in another version', () => {
    const first = mergeSeriesVersions([en, ge])!.seasons[0]!.episodes[0]!;
    expect(episodeInVersion(first, 'ge')).toMatchObject({ id: 'ge-1', seriesId: 'ge', versions: first.versions });
    expect(episodeInVersion(first, 'unknown')).toBe(first);
  });

  it('keeps episodes without a number, and duplicate numbers within one version, separate', () => {
    const odd: SeriesVersion = {
      seriesId: 'x',
      label: 'X',
      details: details('x', { 0: [episode('special', 0, null)], 1: [episode('x-1', 1, 1), episode('x-1b', 1, 1)] }),
    };
    const merged = mergeSeriesVersions([odd, { ...odd, seriesId: 'y', label: 'Y' }])!;
    expect(merged.seasons[0]!.episodes.map((e) => e.id)).toEqual(['special', 'special']);
    expect(ids(merged.seasons[1]!.episodes)).toEqual(['x-1[X,Y]', 'x-1b[X]', 'x-1b[Y]']);
  });

  it('finds saved progress from any version', () => {
    const first = mergeSeriesVersions([en, ge])!.seasons[0]!.episodes[0]!;
    const saved = { kind: 'episode', itemId: 'ge-1', positionSeconds: 60 };
    expect(findEpisodeProgress({ items: { data: [saved] } } as never, first)).toBe(saved);
  });

  it('loads every version, leaves out the ones that fail, and fails only when all do', async () => {
    const requested: string[] = [];
    const api = {
      catalog: {
        seriesDetails: async (id: string) => {
          requested.push(id);
          if (id === 'broken') throw new Error('provider error');
          return id === 'en' ? en.details : ge.details;
        },
      },
    } as never;
    const loaded = await loadSeriesVersions(api, [
      { seriesId: 'en', label: 'ENG 4K' },
      { seriesId: 'broken', label: 'B' },
      { seriesId: 'ge', label: 'GER' },
    ]);
    expect(loaded.map((v) => v.seriesId)).toEqual(['en', 'ge']);
    expect(requested).toEqual(['en', 'broken', 'ge']);
    await expect(loadSeriesVersions(api, [{ seriesId: 'broken', label: 'B' }])).rejects.toThrow('provider error');
    expect(mergeSeriesVersions([])).toBeNull();
  });
});
