import type { SqlDatabase } from './sqlLibrary';

/** Rows not saved again for this long are removed when the database opens. */
export const CATALOG_PRUNE_MS = 30 * 24 * 3600_000;

const TABLE = `CREATE TABLE IF NOT EXISTS catalog_cache (account TEXT NOT NULL, key TEXT NOT NULL, saved_at INTEGER NOT NULL,
  value TEXT NOT NULL, PRIMARY KEY (account, key)) WITHOUT ROWID`;

/**
 * The provider's answers the apps ask for one at a time, kept in the library database (D-125): categories, a movie's
 * info, a series' seasons and episodes, and a channel's next programmes. Each is one row of JSON per account and key,
 * with the time it was saved; how long a row stays fresh is up to the caller.
 */
export function createSqlCatalogCache(db: SqlDatabase, now: () => number = Date.now) {
  let ready: Promise<void> | null = null;
  const prepare = () =>
    (ready ??= db
      .run([{ sql: TABLE }, { sql: 'DELETE FROM catalog_cache WHERE saved_at < ?', rows: [[now() - CATALOG_PRUNE_MS]] }])
      .catch((error: unknown) => {
        ready = null;
        throw error;
      }));

  return {
    async get(account: string, key: string): Promise<{ savedAt: number; value: unknown } | null> {
      await prepare();
      const [row] = await db.query('SELECT saved_at, value FROM catalog_cache WHERE account = ? AND key = ?', [account, key]);
      return row ? { savedAt: Number(row[0]), value: JSON.parse(String(row[1])) as unknown } : null;
    },
    async put(account: string, key: string, value: unknown, savedAt = now()): Promise<void> {
      await prepare();
      await db.run([
        {
          sql: 'INSERT OR REPLACE INTO catalog_cache (account, key, saved_at, value) VALUES (?, ?, ?, ?)',
          rows: [[account, key, savedAt, JSON.stringify(value)]],
        },
      ]);
    },
    /** Removes the account's rows whose key starts with `prefix` ("categories:", "epg:"). */
    async forget(account: string, prefix: string): Promise<void> {
      await prepare();
      await db.run([
        { sql: 'DELETE FROM catalog_cache WHERE account = ? AND substr(key, 1, length(?)) = ?', rows: [[account, prefix, prefix]] },
      ]);
    },
  };
}

export type SqlCatalogCache = ReturnType<typeof createSqlCatalogCache>;
