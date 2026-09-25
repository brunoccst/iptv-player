import { Directory, File, Paths } from 'expo-file-system';
import type { KeyValueStorage } from '@iptv/shared';

/** Plain JSON files in app-private storage for larger, non-secret data (profiles, progress, library cache). See DECISIONS.md#d-038. */
const folder = () => {
  const directory = new Directory(Paths.document, 'app-data');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
};

const fileFor = (key: string) => new File(folder(), `${key.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);

/**
 * Files being read. The native file object can be released when JS no longer references it, even while `text()` is
 * still reading ("Cannot use shared object that was already released", seen at start-up while large library files
 * were read). Holding it here until the read finishes prevents that.
 */
const reading = new Set<File>();

export const fileStorage: KeyValueStorage = {
  async getItem(key) {
    const file = fileFor(key);
    if (!file.exists) return null;
    reading.add(file);
    try {
      return await file.text();
    } finally {
      reading.delete(file);
    }
  },
  setItem(key, value) {
    const file = fileFor(key);
    if (!file.exists) file.create();
    file.write(value);
  },
  removeItem(key) {
    const file = fileFor(key);
    if (file.exists) file.delete();
  },
};
