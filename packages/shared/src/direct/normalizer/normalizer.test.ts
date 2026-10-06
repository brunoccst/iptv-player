import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupTitles } from './matching';
import { normalizeKey, parseTitle } from './parser';
import { buildMasters, buildMastersInChunks, lowSourceOf, type GroupingTimings } from './pipeline';
import { batchedSha1, sha1Hex } from './sha1';
import { packLibrary, unpackLibrary } from '../libraryCodec';

/** The JSON cases in `cases/` (D-017, D-038). */
const load = (name: string) => JSON.parse(readFileSync(new URL(`./cases/${name}.json`, import.meta.url), 'utf8'));

interface ParseCase {
  raw: string;
  title: string;
  year?: number | null;
  quality?: string | null;
  source?: string | null;
  languages?: string[];
  audioTag?: string | null;
  hdr?: boolean;
  subtitles?: string[];
}

const parser = load('parser') as { parse: ParseCase[]; keys: { title: string; key: string }[] };

describe('parseTitle (shared cases)', () => {
  it.each(parser.parse)('$raw', (testCase) => {
    const parsed = parseTitle(testCase.raw);
    const actual = {
      title: parsed.cleanTitle,
      year: parsed.year,
      quality: parsed.quality,
      source: parsed.source,
      languages: parsed.audioLanguages,
      audioTag: parsed.audioTag,
      hdr: parsed.isHdr,
      subtitles: parsed.subtitleLanguages,
    };
    const fields = Object.keys(actual).filter((field) => field in testCase) as (keyof typeof actual)[];
    expect(Object.fromEntries(fields.map((field) => [field, actual[field]]))).toEqual(
      Object.fromEntries(fields.map((field) => [field, testCase[field]])),
    );
  });
});

describe('normalizeKey (shared cases)', () => {
  it.each(parser.keys)('$title → $key', ({ title, key }) => expect(normalizeKey(title)).toBe(key));
});

describe('groupTitles (shared cases)', () => {
  const cases = (load('matching') as { groups: { name: string; titles: string[]; groups: number }[] }).groups;
  it.each(cases)('$name', ({ titles, groups }) => expect(groupTitles(titles.map(parseTitle))).toHaveLength(groups));
});

describe('buildMasters (shared cases)', () => {
  const cases = (load('pipeline') as { masters: { name: string; accountId: string; kind: string; items: []; expect: unknown[] }[] })
    .masters;
  it.each(cases)('$name', ({ accountId, kind, items, expect: expected }) => {
    const masters = buildMasters(accountId, kind, items).map((master) => ({
      id: master.id,
      title: master.title,
      key: master.normalizedKey,
      year: master.year,
      posterUrl: master.posterUrl,
      rating: master.rating,
      bestQuality: master.bestQuality,
      variants: master.variants.map(({ streamId, label, qualityScore, categoryId }) => ({ streamId, label, qualityScore, categoryId })),
    }));
    expect(masters).toEqual(expected);
  });
});

describe('sort keys (shared cases)', () => {
  const cases = (load('pipeline') as { sortKeys: { name: string; kind: string; items: []; expect: unknown[] }[] }).sortKeys;
  it.each(cases)('$name', ({ kind, items, expect: expected }) => {
    const masters = buildMasters('acc', kind, items).map(({ title, addedAt, releaseKey }) => ({ title, addedAt, releaseKey }));
    expect(masters).toEqual(expected);
  });
});

describe('version labels', () => {
  it('label the EAR version "ENG (EAR)" and the plain English one "ENG" (D-148)', () => {
    const [master] = buildMasters('acc', 'movie', [
      { id: '1', name: 'EAR - Backrooms (2026)' },
      { id: '2', name: 'EN - Backrooms (2026)' },
    ]);
    expect(master!.variants.map(({ streamId, label }) => ({ streamId, label }))).toEqual([
      { streamId: '1', label: 'ENG (EAR)' },
      { streamId: '2', label: 'ENG' },
    ]);
  });
});

describe('helpers', () => {
  it('sha1Hex matches known digests', () => {
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('a'.repeat(1000))).toBe('291e9a6c66994949b57ba5e650361e98fc36b1ba');
  });
});

describe('grouping large libraries (D-038)', () => {
  it('groups by TMDB id and year, else by key and year (D-133)', () => {
    const names = ['Money Heist (2017)', 'La Casa de Papel (2017) 4K', 'La Casa de Papel (2017)', 'Money Heist (2021)', 'Dark (2017)'];
    const groups = groupTitles(names.map(parseTitle), ['71446', '71446', null, '71446', null]);
    // The key takes its smallest TMDB id: "La Casa de Papel" without one still joins; another year stays apart.
    expect(groups).toEqual([[0, 1, 2], [3], [4]]);
    // A year-less key takes its only year first, then joins by TMDB id.
    expect(groupTitles(['Dune', 'Dune (2021)', 'Duna (2021)'].map(parseTitle), [null, '438631', '438631'])).toEqual([[0, 1, 2]]);
  });

  it('buildMastersInChunks reports progress up to the total and matches buildMasters', async () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({
      id: i + 1,
      name: `Film ${i % 1000} (${2000 + (i % 3)}) ${['4K', '1080p', ''][i % 3]}`,
      // Some titles share a TMDB id with one of the same year: those merge (D-065).
      tmdbId: i % 30 === 0 || i % 30 === 3 ? 5000 + Math.floor(i / 30) : undefined,
    }));
    const reported: number[] = [];
    const masters = await buildMastersInChunks('acc', 'movie', items, { onProgress: (done, total) => reported.push(done / total) });
    expect(masters).toEqual(buildMasters('acc', 'movie', items));
    expect(masters).toHaveLength(2900);
    expect(reported.at(-1)).toBe(1);
    expect(reported.every((value, index) => index === 0 || value >= reported[index - 1]!)).toBe(true);
  });

  it('buildMastersInChunks can hash the new ids all at once, with the same result (D-118)', async () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({ id: i + 1, name: `Film ${i % 1000} (${2000 + (i % 3)}) Über` }));
    const batches: string[][] = [];
    const hashIds = async (texts: string[]) => {
      batches.push(texts);
      return texts.map(sha1Hex);
    };
    const masters = await buildMastersInChunks('acc', 'movie', items, { hashIds });
    expect(masters).toEqual(buildMasters('acc', 'movie', items));
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(masters.length);

    // An update: only the new titles are hashed.
    const today = [...items, { id: 9999, name: 'A New Film (2024)' }];
    const updated = await buildMastersInChunks('acc', 'movie', today, { previous: masters, hashIds });
    expect(updated).toEqual(buildMasters('acc', 'movie', today));
    expect(batches[1]).toEqual(['acc|movie|newfilm|2024']);
  });

  it('batchedSha1 sends plain-ASCII texts in batches, hashes the rest itself, and falls back when native code fails (D-118)', async () => {
    const texts = ['acc|movie|a|2001', 'acc|movie|über|', 'acc|movie|b|', 'acc|movie|日本|2020', 'acc|movie|c|1999'];
    const sent: string[] = [];
    const native = async (joined: string) => {
      sent.push(joined);
      return joined.split('\n').map(sha1Hex).join('');
    };
    expect(await batchedSha1(native, 2)(texts)).toEqual(texts.map(sha1Hex));
    expect(sent).toEqual(['acc|movie|a|2001\nacc|movie|b|', 'acc|movie|c|1999']);

    const failing = async () => {
      throw new Error('native module missing');
    };
    expect(await batchedSha1(failing)(texts)).toEqual(texts.map(sha1Hex));
    expect(await batchedSha1(async () => 'short')(texts)).toEqual(texts.map(sha1Hex));
  });

  it('buildMastersInChunks reports how long each step took, without the breaks (D-116)', async () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({ id: i + 1, name: `Film ${i % 1000} (${2000 + (i % 3)})` }));
    let timings: GroupingTimings | null = null;
    const started = Date.now();
    // sliceMs 0: a break at every chunk, so the waiting is counted too.
    await buildMastersInChunks('acc', 'movie', items, { chunkSize: 100, sliceMs: 0, onTimings: (reported) => (timings = reported) });
    const elapsed = Date.now() - started;
    const time = timings as unknown as GroupingTimings;
    expect(time.breaks).toBeGreaterThan(10);
    const steps = [time.names, time.keys, time.titles, time.sort];
    expect(steps.every((ms) => ms >= 0) && time.waiting >= 0).toBe(true);
    expect(steps.reduce((sum, ms) => sum + ms, 0) + time.waiting).toBeLessThanOrEqual(elapsed);
    expect(time.names + time.titles).toBeGreaterThan(0);
  });

  it('buildMastersInChunks runs a job it is asked to yield to before going on, with the same result (D-093)', async () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({ id: i + 1, name: `Film ${i % 1000} (${2000 + (i % 3)})` }));
    const order: string[] = [];
    let asked = 0;
    const masters = await buildMastersInChunks('acc', 'movie', items, {
      chunkSize: 100,
      onProgress: (done) => done > 0 && order.length === 0 && order.push('movies started'),
      yieldTo: () =>
        ++asked === 3
          ? new Promise<void>((resolve) =>
              setTimeout(() => {
                order.push('series grouped');
                resolve();
              }, 0),
            )
          : null,
    });
    order.push('movies done');
    expect(order).toEqual(['movies started', 'series grouped', 'movies done']);
    expect(masters).toEqual(buildMasters('acc', 'movie', items));
  });
});

describe('updates reuse the last library (D-109)', () => {
  const yesterday = [
    { id: 1, name: 'EN - Big Movie (2020) [4K]', categoryId: '1', posterUrl: 'http://img/a.jpg', rating: 7, addedAt: 100 },
    { id: 2, name: 'Big.Movie.2020.1080p.WEB-DL', categoryId: '1', addedAt: 90 },
    { id: 3, name: 'Other Film (2019)', categoryId: '2', addedAt: 80 },
    { id: 4, name: 'Old Show (2001) SUB ITA', categoryId: '2', addedAt: 70 },
    { id: 5, name: 'Renamed Soon (2018)', categoryId: '3', addedAt: 60 },
    { id: 6, name: 'Moves Category (2017)', categoryId: '3', addedAt: 50 },
    { id: 7, name: 'Dated By Release', categoryId: '3', releaseDate: '2015-04-01', addedAt: 40 },
  ];
  const today = [
    ...yesterday.filter((item) => item.id !== 4 && item.id !== 5 && item.id !== 6),
    // A new version of an existing title, a renamed one, one in another category, a brand-new title.
    { id: 8, name: 'Big Movie (2020) CAM', categoryId: '1', addedAt: 200 },
    { id: 5, name: 'Renamed Now (2018)', categoryId: '3', addedAt: 60 },
    { id: 6, name: 'Moves Category (2017)', categoryId: '9', addedAt: 50 },
    { id: 9, name: 'Brand New (2026)', categoryId: '4', addedAt: 300 },
  ];

  it('gives the same library as a full rebuild, and reuses what did not change', async () => {
    const previous = buildMasters('acc', 'movie', yesterday);
    let counts = { names: 0, masters: 0 };
    const updated = await buildMastersInChunks('acc', 'movie', today, { previous, onReuse: (reused) => (counts = reused) });
    expect(updated).toEqual(buildMasters('acc', 'movie', today));
    // Names 1, 2, 3, 6 and 7 were seen yesterday; only "Other Film" is the same title with the same versions ("Big
    // Movie" got a version, 6 moved, 7 has a release date).
    expect(counts).toEqual({ names: 5, masters: 1 });
    expect(updated.find((master) => master.title === 'Other Film')).toBe(previous.find((master) => master.title === 'Other Film'));
  });

  it('also after a save and load, and nothing is reused from a library saved before', async () => {
    const saved = unpackLibrary(JSON.parse(JSON.stringify(packLibrary('2026-09-28T00:00:00Z', buildMasters('acc', 'movie', yesterday)))))!;
    let counts = { names: 0, masters: 0 };
    const updated = await buildMastersInChunks('acc', 'movie', today, { previous: saved.masters, onReuse: (reused) => (counts = reused) });
    expect(updated).toEqual(buildMasters('acc', 'movie', today));
    expect(counts).toEqual({ names: 5, masters: 1 });

    const before = saved.masters.map((master) => ({
      ...master,
      variants: master.variants.map(({ cleanTitle: _title, nameYear: _year, ...variant }) => variant),
    }));
    const rebuilt = await buildMastersInChunks('acc', 'movie', today, { previous: before, onReuse: (reused) => (counts = reused) });
    expect(rebuilt).toEqual(buildMasters('acc', 'movie', today));
    expect(counts).toEqual({ names: 0, masters: 0 });
  });

  it('an unchanged day reuses everything', async () => {
    const previous = buildMasters('acc', 'movie', today);
    let counts = { names: 0, masters: 0 };
    const updated = await buildMastersInChunks('acc', 'movie', today, { previous, onReuse: (reused) => (counts = reused) });
    expect(updated).toEqual(previous);
    // Every name; every title except the one with a release date.
    expect(counts).toEqual({ names: today.length, masters: previous.length - 1 });
  });
});

describe('lowSourceOf (D-141)', () => {
  it('names the least bad cinema copy when every version is one', () => {
    expect(lowSourceOf(['CAM'])).toBe('CAM');
    expect(lowSourceOf(['CAM', 'TS', 'CAM'])).toBe('TS');
    expect(lowSourceOf(['TC', 'SCR'])).toBe('SCR');
  });

  it('is null when one version is better or has no source tag', () => {
    expect(lowSourceOf(['CAM', 'WEB'])).toBeNull();
    expect(lowSourceOf(['TS', null])).toBeNull();
    expect(lowSourceOf([])).toBeNull();
  });

  it('reads HDTS and HDCAM from the names', () => {
    const [master] = buildMasters('acc', 'movie', [
      { id: '1', name: 'EN - New Film (2026) HDTS' },
      { id: '2', name: 'DE - New Film (2026) HDCAM' },
    ]);
    expect(lowSourceOf(master!.variants.map((variant) => variant.source))).toBe('TS');
  });
});
