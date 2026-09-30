import type { SqlDatabase } from '../direct/sqlLibrary';
import { appLog, errorMessage } from '../utils/logger';
import type { KeyValueStorage } from './storage';

const TABLE = 'CREATE TABLE IF NOT EXISTS user_data (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL) WITHOUT ROWID';

/** Profiles, progress, My List and the settings (D-126). Library files, logs and caches stay where they are. */
export const isUserDataKey = (key: string) => /^(direct\.(profiles|progress|watchlist)\.|settings\.)/.test(key);
/** The parental PIN's salted hash (D-054). */
export const isPinKey = (key: string) => key.startsWith('pin.');

const prepared = new WeakMap<SqlDatabase, Promise<void>>();
const prepare = (db: SqlDatabase) => {
  let ready = prepared.get(db);
  if (!ready) {
    ready = db.run([{ sql: TABLE }]);
    ready.catch(() => prepared.delete(db));
    prepared.set(db, ready);
  }
  return ready;
};

/**
 * `base` with the keys `inDatabase` picks kept in the library database (D-126). Such a key still in `base` (the app
 * before D-126, a restored backup written there) is moved into the database the first time it is read, then removed
 * from `base`. If the database fails, `base` answers, as before.
 */
export function createDatabaseStorage(db: SqlDatabase, base: KeyValueStorage, inDatabase: (key: string) => boolean): KeyValueStorage {
  /** Keys known to be gone from `base`: no file to check or remove any more. */
  const moved = new Set<string>();
  /** One operation per key at a time, so a move cannot overwrite a newer value. */
  const queues = new Map<string, Promise<unknown>>();
  const serial = <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const next = (queues.get(key) ?? Promise.resolve()).then(run, run);
    const settled = next.catch(() => undefined);
    queues.set(key, settled);
    void settled.then(() => {
      if (queues.get(key) === settled) queues.delete(key);
    });
    return next;
  };
  const leaveBase = async (key: string) => {
    if (moved.has(key)) return;
    await base.removeItem(key);
    moved.add(key);
  };
  const failed = (key: string, error: unknown) => appLog.warn('storage', `${key}: database failed, using the file: ${errorMessage(error)}`);

  return {
    getItem: (key) =>
      inDatabase(key)
        ? serial(key, async () => {
            try {
              await prepare(db);
              const [row] = await db.query('SELECT value FROM user_data WHERE key = ?', [key]);
              if (row) return String(row[0]);
              if (moved.has(key)) return null;
              const value = await base.getItem(key);
              if (value !== null) {
                await db.run([{ sql: 'INSERT OR REPLACE INTO user_data (key, value) VALUES (?, ?)', rows: [[key, value]] }]);
                appLog.info('storage', `${key}: moved into the database`);
              }
              await leaveBase(key);
              return value;
            } catch (error) {
              failed(key, error);
              return base.getItem(key);
            }
          })
        : base.getItem(key),
    setItem: (key, value) =>
      inDatabase(key)
        ? serial(key, async () => {
            try {
              await prepare(db);
              await db.run([{ sql: 'INSERT OR REPLACE INTO user_data (key, value) VALUES (?, ?)', rows: [[key, value]] }]);
              await leaveBase(key);
            } catch (error) {
              failed(key, error);
              await base.setItem(key, value);
            }
          })
        : base.setItem(key, value),
    removeItem: (key) =>
      inDatabase(key)
        ? serial(key, async () => {
            try {
              await prepare(db);
              await db.run([{ sql: 'DELETE FROM user_data WHERE key = ?', rows: [[key]] }]);
            } catch (error) {
              failed(key, error);
            }
            await leaveBase(key);
          })
        : base.removeItem(key),
  };
}

/**
 * The storages the apps use, with the user's data in the database when there is one (D-126): profiles, progress,
 * My List and settings from `data`, the PIN from `secure`. The sign-in stays in `secure` (encrypted by the system).
 * Without a database (a plain browser), the storages as they are.
 */
export function withUserDatabase<S extends { secure: KeyValueStorage; data: KeyValueStorage }>(
  storages: S,
  db: SqlDatabase | undefined,
): S {
  if (!db) return storages;
  return {
    ...storages,
    secure: createDatabaseStorage(db, storages.secure, isPinKey),
    data: createDatabaseStorage(db, storages.data, isUserDataKey),
  };
}
