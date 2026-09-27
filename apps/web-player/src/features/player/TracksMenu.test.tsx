// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type Hls from 'hls.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickTrack } from '@iptv/shared';
import { TracksMenu } from './TracksMenu';
import { activeSubtitle, audioTracks, showSubtitle, subtitleTracks } from './tracks';

type FakeHls = Hls & { subtitleTrack: number; subtitleDisplay: boolean; audioTrack: number };
const fakeHls = (subtitles: { id: number; lang?: string; name: string }[], audio: { lang?: string; name: string }[] = []) =>
  ({ audioTracks: audio, audioTrack: 0, subtitleTracks: subtitles, subtitleTrack: -1, subtitleDisplay: false }) as unknown as FakeHls;

describe('subtitles and audio kept for every movie and series (D-087)', () => {
  afterEach(cleanup);

  it('a pick in the menu is applied and handed on to be kept; Off is kept too', () => {
    const hls = fakeHls(
      [
        { id: 0, lang: 'en', name: 'English' },
        { id: 1, lang: 'pt', name: 'Português' },
      ],
      [
        { lang: 'de', name: 'Deutsch' },
        { lang: 'en', name: 'English 5.1' },
      ],
    );
    const onSubtitle = vi.fn();
    const onAudio = vi.fn();
    render(
      <TracksMenu
        hls={hls}
        video={null}
        variants={[]}
        currentStreamId="e1"
        onVariant={vi.fn()}
        onSubtitle={onSubtitle}
        onAudio={onAudio}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Português' }));
    expect([hls.subtitleTrack, hls.subtitleDisplay]).toEqual([1, true]);
    expect(onSubtitle).toHaveBeenLastCalledWith({ language: 'pt', label: 'Português' });

    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(hls.subtitleDisplay).toBe(false);
    expect(onSubtitle).toHaveBeenLastCalledWith({ off: true });

    fireEvent.click(screen.getByRole('button', { name: 'English 5.1' }));
    expect(hls.audioTrack).toBe(1);
    expect(onAudio).toHaveBeenLastCalledWith({ language: 'en', label: 'English 5.1' });
  });

  it("another title's tracks get the same languages, wherever they are in its lists", () => {
    const hls = fakeHls(
      [
        { id: 0, lang: 'pt', name: 'Português' },
        { id: 1, lang: 'en', name: 'English' },
      ],
      [
        { lang: 'en', name: 'English' },
        { lang: 'fr', name: 'Français' },
      ],
    );
    const pick = pickTrack(subtitleTracks(hls, null), { language: 'en', label: 'English' });
    expect(pick).toBe(1);
    showSubtitle(hls, null, pick!);
    expect(activeSubtitle(hls, null)).toBe(1);
    expect(pickTrack(audioTracks(hls), { language: 'en', label: 'English 5.1' })).toBe(0);
  });
});
