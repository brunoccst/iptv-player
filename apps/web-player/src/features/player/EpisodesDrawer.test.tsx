// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MergedEpisode, MergedSeries } from '@iptv/shared';
import { EpisodesDrawer } from './EpisodesDrawer';

const episode = (id: string, season: number, number: number, otherVersionId?: string): MergedEpisode => {
  const base = {
    id,
    seasonNumber: season,
    episodeNumber: number,
    title: `Episode ${id}`,
    plot: null,
    durationSeconds: 2400,
    stillUrl: null,
    containerExtension: 'mp4',
  };
  return {
    ...base,
    seriesId: 's1',
    versions: [
      { seriesId: 's1', label: 'ENG', episode: base },
      ...(otherVersionId ? [{ seriesId: 's2', label: 'GER', episode: { ...base, id: otherVersionId } }] : []),
    ],
  };
};

const series = {
  summary: { id: 's1', name: 'Show' },
  seasons: [
    { number: 1, name: 'Season 1', coverUrl: null, episodes: [episode('a1', 1, 1), episode('a2', 1, 2)] },
    { number: 2, name: 'Season 2', coverUrl: null, episodes: [episode('b1', 2, 1, 'g1'), episode('b2', 2, 2)] },
  ],
} as unknown as MergedSeries;

describe('EpisodesDrawer', () => {
  afterEach(cleanup);

  it('opens on the season playing (also from another version); the episode playing is read-only', () => {
    const onPlay = vi.fn();
    render(<EpisodesDrawer series={series} currentEpisodeId="g1" onPlay={onPlay} />);
    expect((screen.getByLabelText('Season') as HTMLSelectElement).value).toBe('2');
    expect(screen.queryByText('Episode a1')).toBeNull();
    const current = screen.getByText('Episode b1').closest('button')!;
    expect(current.disabled).toBe(true);
    expect(current.getAttribute('aria-current')).toBe('true');
    fireEvent.click(current);
    expect(onPlay).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Episode a2'));
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'a2' }));
  });
});
