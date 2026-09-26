import { describe, expect, it } from 'vitest';
import { buildMasters } from './normalizer/pipeline';
import { packLibrary, packLibraryText, unpackLibrary } from './libraryCodec';

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

  it('ignores files in the old format', () => {
    expect(unpackLibrary({ builtAt: 'x', masters })).toBeNull();
    expect(unpackLibrary(null)).toBeNull();
  });
});
