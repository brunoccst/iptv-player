import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupTitles, groupTitlesAsync, ratio } from './matching';
import { normalizeKey, parseTitle } from './parser';
import { buildMasters, buildMastersInChunks } from './pipeline';
import { sha1Hex } from './sha1';

/** The same JSON cases the Python tests run (services/title-normalizer/tests/cases). See DECISIONS.md#d-038. */
const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../../../services/title-normalizer/tests/cases/${name}.json`, import.meta.url), 'utf8'));

interface ParseCase {
  raw: string;
  title: string;
  year?: number | null;
  quality?: string | null;
  source?: string | null;
  languages?: string[];
  audioTag?: string | null;
  hdr?: boolean;
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

describe('helpers', () => {
  it('sha1Hex matches known digests', () => {
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('a'.repeat(1000))).toBe('291e9a6c66994949b57ba5e650361e98fc36b1ba');
  });

  it('ratio matches rapidfuzz fuzz.ratio', () => {
    expect(ratio('shawshankredemption', 'shawshankredemtion')).toBeCloseTo(97.297, 3);
    expect(ratio('abc', '')).toBe(0);
    expect(ratio('', '')).toBe(100);
  });
});

describe('grouping large libraries (D-038)', () => {
  it('the async version gives the same groups and pauses along the way', async () => {
    const names = Array.from(
      { length: 12_000 },
      (_, i) => `${['EN - ', 'DE - ', ''][i % 3]}Title ${String.fromCharCode(97 + (i % 26))}${Math.floor(i / 26)} (${2000 + (i % 20)})`,
    );
    names.push('Spiderman (2002)', 'Spider-Man (2002)', 'Spider Mann (2002)', 'The Matrix', 'The Matrix (1999)');
    const titles = names.map(parseTitle);
    const pauses: number[] = [];
    const groups = await groupTitlesAsync(titles, async (done) => void pauses.push(done));
    expect(groups).toEqual(groupTitles(titles));
    expect(pauses.length).toBeGreaterThan(3);
    expect(pauses.every((done, index) => done >= 0 && done <= 1 && (index === 0 || done >= pauses[index - 1]!))).toBe(true);
    expect(groups.find((group) => group.includes(names.indexOf('Spiderman (2002)')))?.length).toBe(3);
  });

  it('buildMastersInChunks reports progress up to the total and matches buildMasters', async () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({
      id: i + 1,
      name: `Film ${i % 1000} (${2000 + (i % 3)}) ${['4K', '1080p', ''][i % 3]}`,
    }));
    const reported: number[] = [];
    const masters = await buildMastersInChunks('acc', 'movie', items, { onProgress: (done, total) => reported.push(done / total) });
    expect(masters).toEqual(buildMasters('acc', 'movie', items));
    expect(reported.at(-1)).toBe(1);
    expect(reported.every((value, index) => index === 0 || value >= reported[index - 1]!)).toBe(true);
  });
});
