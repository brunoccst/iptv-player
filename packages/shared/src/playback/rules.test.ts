import { describe, expect, it } from 'vitest';
import type { ProgressDto, SeriesDetails } from '../api/types';
import {
  clampTime,
  continueWatching,
  episodeLabel,
  introWindow,
  isCompleted,
  isInIntro,
  nextEpisode,
  nextUpCountdown,
  resumePosition,
} from './rules';
import { isBrowserNativeContainer, tvPlaybackAttempts, webPlaybackAttempts } from './sources';

const progress = (itemId: string, position: number, updatedAt: string, extra: Partial<ProgressDto> = {}): ProgressDto => ({
  kind: 'movie',
  itemId,
  masterId: null,
  seriesId: null,
  seasonNumber: null,
  episodeNumber: null,
  title: itemId,
  posterUrl: null,
  containerExtension: null,
  positionSeconds: position,
  durationSeconds: 6000,
  updatedAt,
  ...extra,
});

const episode = (id: string, season: number, number: number) => ({
  id,
  seasonNumber: season,
  episodeNumber: number,
  title: id,
  plot: null,
  durationSeconds: 2400,
  stillUrl: null,
  containerExtension: 'mp4',
});

const series: SeriesDetails = {
  summary: {
    id: 's',
    name: 'Show',
    categoryId: null,
    posterUrl: null,
    rating: null,
    plot: null,
    genre: null,
    releaseDate: null,
    lastModifiedAt: null,
  },
  cast: null,
  director: null,
  backdropUrls: [],
  trailerYoutubeId: null,
  seasons: [
    { number: 2, name: 'S2', coverUrl: null, episodes: [episode('s2e1', 2, 1)] },
    { number: 1, name: 'S1', coverUrl: null, episodes: [episode('s1e2', 1, 2), episode('s1e1', 1, 1)] },
  ],
};

describe('playback rules', () => {
  it('completion and resume position', () => {
    expect(isCompleted(5700, 6000)).toBe(true);
    expect(isCompleted(5000, 6000)).toBe(false);
    expect(isCompleted(10, 0)).toBe(false);
    expect(resumePosition({ positionSeconds: 1200, durationSeconds: 6000 })).toBe(1200);
    expect(resumePosition({ positionSeconds: 10, durationSeconds: 6000 })).toBe(0);
    expect(resumePosition({ positionSeconds: 5990, durationSeconds: 6000 })).toBe(0);
    expect(resumePosition(null)).toBe(0);
  });

  it('continue watching keeps unfinished items, one per series, newest first', () => {
    const items = [
      progress('old-ep', 500, '2026-01-01', { kind: 'episode', seriesId: 's' }),
      progress('new-ep', 500, '2026-01-03', { kind: 'episode', seriesId: 's' }),
      progress('done', 5990, '2026-01-04'),
      progress('movie', 800, '2026-01-02'),
      progress('barely', 5, '2026-01-05'),
    ];

    expect(continueWatching(items).map((p) => p.itemId)).toEqual(['new-ep', 'movie']);
  });

  it('intro window, countdown and clamping', () => {
    expect(introWindow('movie', 6000)).toBeNull();
    expect(introWindow('episode', 300)).toBeNull();
    const window = introWindow('episode', 2400);
    expect(isInIntro(window, 30)).toBe(true);
    expect(isInIntro(window, 95)).toBe(false);
    expect(nextUpCountdown(2395.2, 2400, true)).toBe(5);
    expect(nextUpCountdown(2000, 2400, true)).toBeNull();
    expect(nextUpCountdown(2399, 2400, false)).toBeNull();
    expect(clampTime(-5, 100)).toBe(0);
    expect(clampTime(150, 100)).toBe(100);
    expect(clampTime(150, Number.NaN)).toBe(150);
  });

  it('next episode crosses seasons in order', () => {
    expect(nextEpisode(series, 's1e1')?.id).toBe('s1e2');
    expect(nextEpisode(series, 's1e2')?.id).toBe('s2e1');
    expect(nextEpisode(series, 's2e1')).toBeNull();
    expect(episodeLabel(episode('x', 1, 2))).toBe('S01:E02');
  });

  it('web playback attempts try HLS before the original file', () => {
    expect(webPlaybackAttempts('movie', 'mkv')).toEqual([
      { container: 'm3u8', engine: 'hls' },
      { container: 'mkv', engine: 'file' },
    ]);
    expect(webPlaybackAttempts('live', 'ts')).toEqual([{ container: 'm3u8', engine: 'hls' }]);
    expect(tvPlaybackAttempts('movie', 'mkv')).toEqual([
      { container: 'mkv', engine: 'file' },
      { container: 'm3u8', engine: 'hls' },
    ]);
    expect(tvPlaybackAttempts('live', null)[0]).toEqual({ container: 'm3u8', engine: 'hls' });
    expect(isBrowserNativeContainer('MP4')).toBe(true);
    expect(isBrowserNativeContainer('mkv')).toBe(false);
  });
});
