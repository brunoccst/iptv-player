import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../stores/storage';
import type { PlayTarget } from '../playback/targets';
import { bestFile, createSubtitleService, isPreferredTrack, searchQuery, srtToVtt, SUBTITLE_SETTINGS_KEY } from './openSubtitles';

const movie: PlayTarget = { kind: 'movie', streamId: '101', container: 'mp4', title: 'Big Test Movie' };
const episode: PlayTarget = { kind: 'episode', streamId: '9', container: 'mkv', title: 'Test Series', seasonNumber: 1, episodeNumber: 2 };
const SRT = '1\r\n00:00:01,000 --> 00:00:02,500\r\nHello\r\n';

/** A fake api.opensubtitles.com: search answers from `results`, download counts down `remaining`. */
function fakeApi(results: unknown[], { remaining = 4, status = 200 } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code });
    if (url.includes('/login')) return json({ token: 'jwt', base_url: 'vip-api.opensubtitles.com' });
    if (url.includes('/subtitles?')) return status === 200 ? json({ data: results }) : json({ message: 'no' }, status);
    if (url.includes('/download'))
      return remaining > 0 ? json({ link: 'https://dl.opensubtitles.com/file.srt', remaining: --remaining }) : json({ remaining: 0 }, 406);
    if (url.startsWith('https://dl.')) return new Response(SRT);
    return json({}, 404);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const result = (language: string, fileId: number, downloads: number, extra: Record<string, unknown> = {}) => ({
  id: String(fileId),
  attributes: { language, download_count: downloads, files: [{ file_id: fileId }], ...extra },
});

async function service(results: unknown[], settings: Record<string, unknown>, options?: { remaining?: number; status?: number }) {
  const api = fakeApi(results, options);
  const secureStorage = createMemoryStorage({
    [SUBTITLE_SETTINGS_KEY]: JSON.stringify({ enabled: true, apiKey: 'key', languages: ['pt-br', 'en'], ...settings }),
  });
  const subtitles = createSubtitleService({ secureStorage, dataStorage: createMemoryStorage(), fetch: api.fetch, userAgent: 'Test v1' });
  await subtitles.settings.getState().load();
  return { subtitles, calls: api.calls };
}

describe('automatic subtitles from OpenSubtitles (D-111)', () => {
  it('searches with sorted, lower-case parameters, by title and year or by season and episode', () => {
    expect(searchQuery(movie, ['pt-br', 'en'], 2020)).toBe('languages=en,pt-br&query=big+test+movie&type=movie&year=2020');
    expect(searchQuery(episode, ['en'])).toBe('episode_number=2&languages=en&query=test+series&season_number=1&type=episode');
  });

  it('picks the first preferred language that has one; people before machines, then the most downloaded', () => {
    const results = [
      result('en', 1, 900),
      result('pt-br', 2, 50, { machine_translated: true }),
      result('pt-br', 3, 10),
      result('pt-br', 4, 30),
    ];
    expect(bestFile(results, ['pt-br', 'en'])).toEqual({ fileId: 4, language: 'pt-br' });
    expect(bestFile(results, ['de', 'en'])).toEqual({ fileId: 1, language: 'en' });
    expect(bestFile(results, ['de'])).toBeNull();
  });

  it('downloads the subtitle once and keeps it: watching again does not use the daily quota', async () => {
    const { subtitles, calls } = await service([result('en', 7, 5)], {});
    const found = await subtitles.find(movie, { year: 2020 });
    expect(found).toEqual({ language: 'en', label: 'English · OpenSubtitles', srt: SRT });
    const download = calls.find((call) => call.url.endsWith('/download'))!;
    expect(download.init?.body).toBe(JSON.stringify({ file_id: 7 }));
    expect((download.init?.headers as Record<string, string>)['Api-Key']).toBe('key');
    const before = calls.length;
    expect(await subtitles.find(movie)).toEqual(found);
    expect(calls.length).toBe(before);
  });

  it('logs in with the account when one is set, and uses the server it names', async () => {
    const { subtitles, calls } = await service([result('en', 7, 5)], { username: 'ale', password: 'secret' });
    await subtitles.find(episode);
    expect(calls[0]!.url).toBe('https://api.opensubtitles.com/api/v1/login');
    const search = calls.find((call) => call.url.includes('/subtitles?'))!;
    expect(search.url.startsWith('https://vip-api.opensubtitles.com/api/v1/subtitles?')).toBe(true);
    expect((search.init?.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
  });

  it('does nothing when off, without a key, for live TV, or when the stream has a preferred subtitle already', async () => {
    expect(await (await service([result('en', 7, 5)], { enabled: false })).subtitles.find(movie)).toEqual({ message: null });
    expect(await (await service([result('en', 7, 5)], { apiKey: ' ' })).subtitles.find(movie)).toEqual({ message: null });
    const { subtitles, calls } = await service([result('en', 7, 5)], {});
    expect(await subtitles.find({ ...movie, kind: 'live' })).toEqual({ message: null });
    expect(await subtitles.find(movie, { trackLanguages: ['eng'] })).toEqual({ message: null });
    expect(calls).toEqual([]);
    expect(isPreferredTrack('por', ['pt-br'])).toBe(true);
    expect(isPreferredTrack('en-US', ['en'])).toBe(true);
    expect(isPreferredTrack(null, ['en'])).toBe(false);
  });

  it('says why when nothing is found, the key is refused or the daily limit is reached', async () => {
    expect(await (await service([], {})).subtitles.find(movie)).toEqual({ message: 'No subtitles found on OpenSubtitles.' });
    expect(await (await service([], {}, { status: 403 })).subtitles.find(movie)).toEqual({
      message: 'OpenSubtitles did not accept the API key.',
    });
    expect(await (await service([result('en', 7, 5)], {}, { remaining: 0 })).subtitles.find(movie)).toEqual({
      message: 'OpenSubtitles: the daily download limit is reached.',
    });
  });

  it('turns SubRip into WebVTT for the desktop player', () => {
    expect(srtToVtt(`\uFEFF${SRT}`)).toBe('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHello\n');
  });
});
