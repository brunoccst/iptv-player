import * as FileSystem from 'expo-file-system';
import { fileStorage, PART_CHARS } from './dataStorage';

const files = (FileSystem as unknown as { __files: Map<string, string> }).__files;
const names = (key: string) => [...files.keys()].filter((name) => name.startsWith(key)).sort();

describe('app data files (D-113)', () => {
  it('keeps a large value in parts of at most PART_CHARS, never between the halves of an emoji', async () => {
    const big = 'a'.repeat(PART_CHARS - 1) + '😀' + 'b'.repeat(PART_CHARS) + 'é';
    await fileStorage.setItem('library.movie', big);
    expect(names('library.movie')).toEqual([
      'library.movie.json',
      'library.movie.part0.json',
      'library.movie.part1.json',
      'library.movie.part2.json',
    ]);
    for (const name of names('library.movie.part')) expect(files.get(name)!.length).toBeLessThanOrEqual(PART_CHARS);
    // The first part stops before the emoji instead of splitting it.
    expect(files.get('library.movie.part0.json')!.length).toBe(PART_CHARS - 1);
    expect(await fileStorage.getItem('library.movie')).toBe(big);

    // A smaller value replaces it and its old parts go.
    await fileStorage.setItem('library.movie', 'small');
    expect(names('library.movie')).toEqual(['library.movie.json']);
    expect(await fileStorage.getItem('library.movie')).toBe('small');

    await fileStorage.setItem('library.movie', big);
    await fileStorage.removeItem('library.movie');
    expect(names('library.movie')).toEqual([]);
    expect(await fileStorage.getItem('library.movie')).toBeNull();
  });

  it('a missing part reads as nothing saved (the library is then built again)', async () => {
    await fileStorage.setItem('library.series', 'x'.repeat(PART_CHARS * 2));
    files.delete('library.series.part1.json');
    expect(await fileStorage.getItem('library.series')).toBeNull();
  });
});
