import type Hls from 'hls.js';
import { describe, expect, it, vi } from 'vitest';
import { pickTrack } from '@iptv/shared';
import { activeSubtitle, audioTracks, showSubtitle, subtitleTracks, trackOptions } from './tracks';

type FakeHls = Hls & { subtitleTrack: number; subtitleDisplay: boolean; audioTrack: number };
const fakeHls = (subtitles: { id: number; lang?: string; name: string }[], audio: { lang?: string; name: string }[] = []) =>
  ({ audioTracks: audio, audioTrack: 0, subtitleTracks: subtitles, subtitleTrack: -1, subtitleDisplay: false }) as unknown as FakeHls;

describe('subtitles and audio kept for every movie and series (D-087)', () => {
  it("a pick in the player's panel is applied and handed on to be kept; Off is kept too", () => {
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
    const on = { audio: vi.fn(), subtitles: vi.fn(), changed: vi.fn() };
    const options = () => trackOptions(hls, null, on);

    expect(options().subtitles.map((track) => [track.label, track.selected])).toEqual([
      ['English', false],
      ['Português', false],
    ]);
    options().subtitles[1]!.pick();
    expect([hls.subtitleTrack, hls.subtitleDisplay]).toEqual([1, true]);
    expect(on.subtitles).toHaveBeenLastCalledWith({ language: 'pt', label: 'Português' });
    expect(options().subtitles[1]!.selected).toBe(true);

    options().subtitlesOff();
    expect(hls.subtitleDisplay).toBe(false);
    expect(on.subtitles).toHaveBeenLastCalledWith({ off: true });

    options().audio[1]!.pick();
    expect(hls.audioTrack).toBe(1);
    expect(on.audio).toHaveBeenLastCalledWith({ language: 'en', label: 'English 5.1' });
    expect(options().audio.map((track) => track.selected)).toEqual([false, true]);
    expect(on.changed).toHaveBeenCalledTimes(3);
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
