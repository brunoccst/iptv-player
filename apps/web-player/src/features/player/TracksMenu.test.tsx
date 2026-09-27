// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type Hls from 'hls.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickSubtitle } from '@iptv/shared';
import { TracksMenu } from './TracksMenu';
import { activeSubtitle, showSubtitle, subtitleTracks } from './subtitles';

const fakeHls = (tracks: { id: number; lang?: string; name: string }[]) =>
  ({ audioTracks: [], subtitleTracks: tracks, subtitleTrack: -1, subtitleDisplay: false }) as unknown as Hls & {
    subtitleTrack: number;
    subtitleDisplay: boolean;
  };

describe('subtitles kept for the series (D-087)', () => {
  afterEach(cleanup);

  it('a pick in the menu shows it and is handed on to be kept; Off is kept too', () => {
    const hls = fakeHls([
      { id: 0, lang: 'en', name: 'English' },
      { id: 1, lang: 'pt', name: 'Português' },
    ]);
    const onSubtitle = vi.fn();
    render(
      <TracksMenu
        hls={hls}
        video={null}
        variants={[]}
        currentStreamId="e1"
        onVariant={vi.fn()}
        onSubtitle={onSubtitle}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Português' }));
    expect([hls.subtitleTrack, hls.subtitleDisplay]).toEqual([1, true]);
    expect(onSubtitle).toHaveBeenLastCalledWith({ language: 'pt', label: 'Português' });

    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(hls.subtitleDisplay).toBe(false);
    expect(onSubtitle).toHaveBeenLastCalledWith({ off: true });
  });

  it("the next episode's tracks get the same language, wherever it is in their list", () => {
    const hls = fakeHls([
      { id: 0, lang: 'pt', name: 'Português' },
      { id: 1, lang: 'en', name: 'English' },
    ]);
    const pick = pickSubtitle(subtitleTracks(hls, null), { language: 'en', label: 'English' });
    expect(pick).toBe(1);
    showSubtitle(hls, null, pick!);
    expect(activeSubtitle(hls, null)).toBe(1);
  });
});
