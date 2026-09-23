import { describe, expect, it } from 'vitest';
import type { ProgressDto } from '@iptv/shared';
import { downloadTarget, episodeTarget, progressTarget } from './targets';

describe('targets', () => {
  it('episode target carries series context for next-up and progress', () => {
    const target = episodeTarget(
      { title: 'Show', masterId: 'm', seriesId: 's', posterUrl: 'p' },
      {
        id: 'e2',
        seasonNumber: 1,
        episodeNumber: 2,
        title: 'Two',
        plot: null,
        durationSeconds: 100,
        stillUrl: null,
        containerExtension: 'mkv',
      },
    );

    expect(target).toMatchObject({
      kind: 'episode',
      streamId: 'e2',
      container: 'mkv',
      subtitle: 'S01:E02 · Two',
      seriesId: 's',
      posterUrl: 'p',
    });
  });

  it('progress target resumes at the saved position', () => {
    const progress: ProgressDto = {
      kind: 'episode',
      itemId: 'e1',
      masterId: 'm',
      seriesId: 's',
      seasonNumber: 2,
      episodeNumber: 3,
      title: 'Show',
      posterUrl: null,
      containerExtension: 'mp4',
      positionSeconds: 321,
      durationSeconds: 2000,
      updatedAt: '2026-01-01T00:00:00Z',
    };

    expect(progressTarget(progress)).toMatchObject({ kind: 'episode', streamId: 'e1', startAt: 321, subtitle: 'S02:E03' });
  });

  it('live channels cannot become download targets', () => {
    expect(() => downloadTarget({ kind: 'live', streamId: '1', container: 'm3u8', title: 'News' })).toThrow();
  });
});
