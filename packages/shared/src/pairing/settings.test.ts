import { describe, expect, it } from 'vitest';
import { mergeProfilePrefs, mergeSubtitleSettings } from './settings';

describe('settings merged by pairing (D-162)', () => {
  it("the phone's values win, a value only on the other device stays", () => {
    expect(
      mergeProfilePrefs(
        { appLanguage: 'pt-BR', playback: { subtitles: { off: true } } },
        { appLanguage: 'de', languages: ['GER'], playback: { audio: { language: 'en', label: 'English' } } },
      ),
    ).toEqual({ appLanguage: 'pt-BR', languages: ['GER'], playback: { subtitles: { off: true } } });
  });

  it("languages and the older single language are one choice: the phone's", () => {
    expect(mergeProfilePrefs({ language: 'ENG' }, { languages: ['GER'] })).toEqual({ language: 'ENG' });
    expect(mergeProfilePrefs({ languages: [] }, { languages: ['GER'], language: 'GER' })).toEqual({ languages: [] });
  });

  it("recent channels: the phone's first, then the other device's, at most 20", () => {
    const channel = (id: string) => ({ id, name: id, logoUrl: null, categoryId: null });
    const merged = mergeProfilePrefs(
      { recentChannels: [channel('a'), channel('b')] },
      { recentChannels: [channel('b'), ...Array.from({ length: 25 }, (_, i) => channel(`tv${i}`))] },
    );
    expect(merged.recentChannels!.map((c) => c.id).slice(0, 4)).toEqual(['a', 'b', 'tv0', 'tv1']);
    expect(merged.recentChannels).toHaveLength(20);
  });

  it('automatic subtitles: the side with an API key, the phone first', () => {
    const phone = JSON.stringify({ enabled: true, apiKey: 'p' });
    const tv = JSON.stringify({ enabled: true, apiKey: 't' });
    expect(mergeSubtitleSettings(phone, tv)).toBe(phone);
    expect(mergeSubtitleSettings(JSON.stringify({ enabled: false, apiKey: '' }), tv)).toBe(tv);
    expect(mergeSubtitleSettings(null, null)).toBeNull();
  });
});
