import { describe, expect, it } from 'vitest';
import type { ProgressDto } from '../api/types';
import { progressDetails } from './targets';

const entry = (over: Partial<ProgressDto>): ProgressDto => ({
  containerExtension: 'mkv',
  durationSeconds: 3600,
  episodeNumber: null,
  itemId: '1',
  kind: 'movie',
  masterId: 'm1',
  positionSeconds: 600,
  posterUrl: null,
  seasonNumber: null,
  seriesId: null,
  title: 'A',
  updatedAt: '2026-10-05T00:00:00Z',
  ...over,
});

describe('progressDetails (issue #166)', () => {
  it("is the movie's page, or the episode's series page", () => {
    expect(progressDetails(entry({}))).toEqual({ section: 'movies', masterId: 'm1' });
    expect(progressDetails(entry({ kind: 'episode', masterId: 's1', seriesId: '9', seasonNumber: 1, episodeNumber: 2 }))).toEqual({
      section: 'series',
      masterId: 's1',
    });
  });

  it('is null without a library title', () => {
    expect(progressDetails(entry({ masterId: null }))).toBeNull();
  });
});
