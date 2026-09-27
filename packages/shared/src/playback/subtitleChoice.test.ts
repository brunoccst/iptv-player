import { describe, expect, it } from 'vitest';
import { createProfilePrefsStore } from '../stores/profilePrefsStore';
import { createMemoryStorage } from '../stores/storage';
import { MAX_SUBTITLE_CHOICES, pickSubtitle, rememberSubtitle, subtitleChoiceFor, subtitleKey, withSubtitleChoice } from './subtitleChoice';

const episode = (masterId: string | null, seriesId = 's1') => ({ kind: 'episode', masterId, seriesId });

describe('subtitle choice kept per series (D-087)', () => {
  it('is kept per series, across its versions; not for movies or live channels', () => {
    expect(subtitleKey(episode('m1', 's1'))).toBe('m1');
    expect(subtitleKey(episode(null, 's1'))).toBe('s1');
    expect(subtitleKey({ kind: 'movie', masterId: 'm2' })).toBeNull();
    expect(subtitleKey({ kind: 'live' })).toBeNull();
  });

  it('matches the track again by language and name, not by position', () => {
    const tracks = [
      { language: 'en', label: 'English' },
      { language: 'pt', label: 'Português' },
      { language: 'pt', label: 'Português (forced)' },
    ];
    expect(pickSubtitle(tracks, { language: 'pt', label: 'Português (forced)' })).toBe(2);
    expect(pickSubtitle(tracks, { language: 'PT', label: 'Portuguese' })).toBe(1);
    expect(pickSubtitle(tracks, { language: null, label: 'english' })).toBe(0);
    expect(pickSubtitle(tracks, { language: 'de', label: 'Deutsch' })).toBeNull();
    expect(pickSubtitle(tracks, { off: true })).toBe(-1);
    expect(pickSubtitle(tracks, null)).toBeNull();
  });

  it('keeps the newest choices per profile', () => {
    let subtitles = {};
    for (let i = 0; i < MAX_SUBTITLE_CHOICES + 5; i++) subtitles = withSubtitleChoice({ subtitles }, `m${i}`, { off: true });
    const keys = Object.keys(subtitles);
    expect(keys).toHaveLength(MAX_SUBTITLE_CHOICES);
    expect(keys.at(-1)).toBe(`m${MAX_SUBTITLE_CHOICES + 4}`);
    expect(keys).not.toContain('m0');
    // Choosing again moves a series to the newest end.
    expect(Object.keys(withSubtitleChoice({ subtitles }, 'm10', { off: true })).at(-1)).toBe('m10');
  });

  it("is saved for the open profile and read back for the series' next episode", async () => {
    const storage = createMemoryStorage();
    const profilePrefs = createProfilePrefsStore(storage);
    let activeProfileId: string | null = 'p1';
    const stores = { session: { getState: () => ({ activeProfileId }) }, profilePrefs };

    rememberSubtitle(stores, episode('m1'), { language: 'pt', label: 'Português' });
    rememberSubtitle(stores, { kind: 'movie', masterId: 'm9' }, { off: true });
    expect(subtitleChoiceFor(stores, episode('m1', 'other-version'))).toEqual({ language: 'pt', label: 'Português' });
    expect(subtitleChoiceFor(stores, episode('m2'))).toBeNull();
    expect(profilePrefs.getState().prefs.p1?.subtitles).toEqual({ m1: { language: 'pt', label: 'Português' } });

    activeProfileId = 'p2';
    expect(subtitleChoiceFor(stores, episode('m1'))).toBeNull();

    const again = createProfilePrefsStore(storage);
    await again.getState().load();
    expect(again.getState().prefs.p1?.subtitles?.m1).toEqual({ language: 'pt', label: 'Português' });
  });
});
