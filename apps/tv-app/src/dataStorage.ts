import { Directory, File, Paths } from 'expo-file-system';
import type { KeyValueStorage } from '@iptv/shared';

/** Plain JSON files in app-private storage for larger, non-secret data (profiles, progress, library cache). See DECISIONS.md#d-038. */
const folder = () => {
  const directory = new Directory(Paths.document, 'app-data');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
};

const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
const fileFor = (key: string) => new File(folder(), `${safe(key)}.json`);
const partFor = (key: string, index: number) => new File(folder(), `${safe(key)}.part${index}.json`);

/**
 * Values longer than this are kept in several files (D-113): a library of 160,000 titles is ~30 MB of text, and one
 * file meant one Java string that size (twice that as UTF-16) while reading or writing it, too much for TVs with a
 * 192 MB Java heap. The main file then holds only `PARTS` and the number of parts.
 */
export const PART_CHARS = 4_000_000;
/**
 * Starts the main file of a value in parts. Plain ASCII that no JSON text starts with. (It used to begin with a NUL
 * character, but Expo hands text to Android as a C string that ends at the first NUL, so the file was saved empty and
 * the library read as "nothing saved" at every start.)
 */
const PARTS = '#parts:';

/**
 * Files being read. The native file object can be released when JS no longer references it, even while `text()` is
 * still reading ("Cannot use shared object that was already released", seen at start-up while large library files
 * were read). Holding it here until the read finishes prevents that.
 */
const reading = new Set<File>();

async function read(file: File): Promise<string> {
  reading.add(file);
  try {
    return await file.text();
  } finally {
    reading.delete(file);
  }
}

function write(file: File, value: string) {
  if (!file.exists) file.create();
  file.write(value);
}

/** Removes the parts of an earlier value from `from` on. */
function removeParts(key: string, from: number) {
  for (let index = from; ; index++) {
    const part = partFor(key, index);
    if (!part.exists) return;
    part.delete();
  }
}

export const fileStorage: KeyValueStorage = {
  async getItem(key) {
    const file = fileFor(key);
    if (!file.exists) return null;
    const text = await read(file);
    if (!text.startsWith(PARTS)) return text;
    const count = Number(text.slice(PARTS.length));
    const files = Array.from({ length: count }, (_, index) => partFor(key, index));
    if (files.some((part) => !part.exists)) return null;
    // All at once: native code reads each part on its own thread, so reading 9 parts does not take 9 turns (D-120).
    return (await Promise.all(files.map(read))).join('');
  },
  setItem(key, value) {
    if (value.length <= PART_CHARS) {
      write(fileFor(key), value);
      removeParts(key, 0);
      return;
    }
    let count = 0;
    for (let start = 0; start < value.length; count++) {
      let end = Math.min(value.length, start + PART_CHARS);
      // Never between the two halves of a character outside the BMP (an emoji): each half alone is not valid UTF-8.
      const last = value.charCodeAt(end - 1);
      if (end < value.length && last >= 0xd800 && last <= 0xdbff) end--;
      write(partFor(key, count), value.slice(start, end));
      start = end;
    }
    removeParts(key, count);
    // Written last: until then the previous value (or none) is what a read finds.
    write(fileFor(key), `${PARTS}${count}`);
  },
  removeItem(key) {
    const file = fileFor(key);
    if (file.exists) file.delete();
    removeParts(key, 0);
  },
};
