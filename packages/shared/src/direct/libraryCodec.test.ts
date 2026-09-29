import { describe, expect, it } from 'vitest';
import { buildMasters } from './normalizer/pipeline';
import { packLibrary, packLibraryText, readLibraryText, unpackLibrary, unpackLibraryInSlices } from './libraryCodec';

describe('library codec', () => {
  const masters = buildMasters('acc', 'movie', [
    { id: 1, name: 'Big Movie (2020) 4K', posterUrl: 'http://img.tv/p/a.jpg', rating: 7.5, containerExtension: 'mkv', categoryId: '3' },
    { id: 2, name: 'Big Movie 2020 1080p', posterUrl: 'http://img.tv/p/b.jpg', rating: 8, containerExtension: 'mp4' },
    { id: 3, name: 'Other SUB ITA', posterUrl: null },
  ]);

  it('round-trips masters and is smaller than plain JSON', () => {
    const packed = packLibrary('2026-09-24T00:00:00Z', masters);
    expect(packed.prefixes).toEqual(['http://img.tv/p/']);
    const restored = unpackLibrary(JSON.parse(JSON.stringify(packed)));
    expect(restored).toEqual({ builtAt: '2026-09-24T00:00:00Z', masters });
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(masters).length * 0.6);
  });

  it('the chunked text is the same data as the packed object', async () => {
    let pauses = 0;
    const text = await packLibraryText('2026-09-24T00:00:00Z', masters, async () => void pauses++, 1);
    expect(pauses).toBe(masters.length);
    expect(JSON.parse(text)).toEqual(packLibrary('2026-09-24T00:00:00Z', masters));
    expect(unpackLibrary(JSON.parse(text))).toEqual({ builtAt: '2026-09-24T00:00:00Z', masters });
  });

  it('a library built with older title rules still shows, but counts as out of date (D-086)', () => {
    const { rules: _rules, ...older } = packLibrary('2026-09-24T00:00:00Z', masters);
    expect(unpackLibrary(JSON.parse(JSON.stringify(older)))).toEqual({ builtAt: new Date(0).toISOString(), masters });
  });

  it('ignores files in the old format', () => {
    expect(unpackLibrary({ builtAt: 'x', masters })).toBeNull();
    expect(unpackLibrary(null)).toBeNull();
  });

  it('unpacks in slices with the same result, letting the screen run in between (D-117)', async () => {
    const many = buildMasters(
      'acc',
      'movie',
      Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, name: `Film ${i} (2001)`, posterUrl: `http://img.tv/p/${i}.jpg` })),
    );
    const value = JSON.parse(JSON.stringify(packLibrary('2026-09-24T00:00:00Z', many)));
    let pauses = 0;
    // A slice of 0 ms: a pause after every 500 titles.
    const sliced = await unpackLibraryInSlices(value, async () => void pauses++, 0);
    expect(sliced).toEqual(unpackLibrary(value));
    expect(pauses).toBe(Math.floor(many.length / 500));
    expect(pauses).toBeGreaterThan(1);
    expect(await unpackLibraryInSlices(null, async () => undefined)).toBeNull();
  });

  it('reads the saved text a line of titles at a time; older texts without lines in one piece (D-120)', async () => {
    const text = await packLibraryText('2026-09-24T00:00:00Z', masters, async () => undefined, 1);
    expect(masters.length).toBeGreaterThan(1);
    // Still one JSON document, as older versions of the app read it.
    expect(unpackLibrary(JSON.parse(text))).toEqual({ builtAt: '2026-09-24T00:00:00Z', masters });
    let pauses = 0;
    const read = await readLibraryText(text, async () => void pauses++, 0);
    expect(read).toEqual({ builtAt: '2026-09-24T00:00:00Z', masters, pieces: masters.length });
    expect(pauses).toBe(masters.length);

    const oneLine = JSON.stringify(packLibrary('2026-09-24T00:00:00Z', masters));
    expect(await readLibraryText(oneLine, async () => undefined)).toEqual({ builtAt: '2026-09-24T00:00:00Z', masters, pieces: 0 });

    const empty = await packLibraryText('2026-09-24T00:00:00Z', [], async () => undefined);
    expect(await readLibraryText(empty, async () => undefined)).toEqual({ builtAt: '2026-09-24T00:00:00Z', masters: [], pieces: 0 });
    // Older title rules: shown, but out of date (D-086).
    const older = text.replace(`"rules":${JSON.parse(text).rules},`, '');
    expect((await readLibraryText(older, async () => undefined))?.builtAt).toBe(new Date(0).toISOString());
    expect(await readLibraryText('{"builtAt":"x"}', async () => undefined)).toBeNull();
  });
});
