import type { LibraryListQuery } from '../api/apiClient';
import type { LibraryPage, LibrarySort, MasterCard } from '../api/types';
import { NORMALIZER_RULES, packer, unpacker, type PackedMaster } from './libraryCodec';
import type { Master } from './normalizer/pipeline';

export type SqlValue = string | number | null;

/**
 * An SQLite database reached through the app's native code (TV/phone: Android's own SQLite, D-121). Only features of
 * SQLite 3.9 (Android 7) are used.
 */
export interface SqlDatabase {
  /** Runs each statement once per row of parameters (once without `rows`), all in one transaction. */
  run(statements: { sql: string; rows?: SqlValue[][] }[]): Promise<void>;
  /** The rows of a query, each an array of its columns' values. */
  query(sql: string, params?: SqlValue[]): Promise<SqlValue[][]>;
}

export type LibraryKind = 'movie' | 'series';

/** What the database holds for one account and kind. */
export interface SqlLibraryKind {
  table: string;
  builtAt: string;
  /** Built with the current title rules (D-086); otherwise shown, but out of date. */
  current: boolean;
  count: number;
  sorts: LibrarySort[];
  prefixes: string[];
}

/** Titles written per statement batch (one native call). */
const WRITE_BATCH = 1000;
/** How long the last build's tables stay after a new one is in place. */
const RETIRE_MS = 60_000;
/** Titles read per query when all of them are needed (an update reusing the last library). */
const READ_BATCH = 5000;

const META = `CREATE TABLE IF NOT EXISTS library (
  account TEXT NOT NULL, kind TEXT NOT NULL, tbl TEXT NOT NULL, built_at TEXT NOT NULL, rules INTEGER NOT NULL,
  count INTEGER NOT NULL, sorts TEXT NOT NULL, prefixes TEXT NOT NULL, PRIMARY KEY (account, kind))`;

/**
 * The list orders (D-049): missing values last, then title, year and id. Newest first is the order the titles are saved
 * in (the row order); each other order is a number per title, worked out once when saving (small indexes).
 */
const ORDERS: Record<string, { column: string; by: string }> = {
  'added|asc': { column: 'a0', by: 'added IS NULL, added, title, IFNULL(year, -1), id' },
  'released|desc': { column: 'r1', by: 'released IS NULL, released DESC, title, IFNULL(year, -1), id' },
  'released|asc': { column: 'r0', by: 'released IS NULL, released, title, IFNULL(year, -1), id' },
  'title|asc': { column: 't0', by: 'title, IFNULL(year, -1), id' },
  'title|desc': { column: 't1', by: 'title DESC, IFNULL(year, -1), id' },
};

/**
 * - `${t}`: what lists filter and search on, one row per title (rowid: newest first). `cats`, `langs` and `hints` are
 *   lists like ",10,11,": the title's categories, its audio and subtitle languages, and the categories of its versions
 *   without a language (the category hint, D-086).
 * - `${t}_d`: everything about the title (its versions), packed as in the saved file (D-038).
 * - `${t}_c`: title by category, for category pages and Kids profiles.
 * - `${t}_s`: what the orders sort by; only while saving.
 */
const tables = (t: string) => [
  `CREATE TABLE ${t} (id TEXT NOT NULL, lower TEXT NOT NULL, nkey TEXT NOT NULL, ncat INTEGER NOT NULL, cats TEXT NOT NULL,
    langs TEXT NOT NULL, hints TEXT NOT NULL, a0 INTEGER, r1 INTEGER, r0 INTEGER, t0 INTEGER, t1 INTEGER)`,
  `CREATE TABLE ${t}_d (m INTEGER PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE ${t}_c (cat TEXT NOT NULL, m INTEGER NOT NULL, PRIMARY KEY (cat, m)) WITHOUT ROWID`,
  `CREATE TABLE ${t}_s (m INTEGER PRIMARY KEY, id TEXT NOT NULL, title TEXT NOT NULL, year INTEGER, added INTEGER, released INTEGER)`,
];

/** After the rows: each order's numbers (a sorted copy's row numbers) and their indexes. */
const finish = (t: string) => [
  ...Object.values(ORDERS).flatMap(({ column, by }) => [
    `CREATE TABLE ${t}_o (m INTEGER NOT NULL)`,
    `INSERT INTO ${t}_o (m) SELECT m FROM ${t}_s ORDER BY ${by}`,
    `CREATE UNIQUE INDEX ${t}_om ON ${t}_o(m)`,
    `UPDATE ${t} SET ${column} = (SELECT rowid FROM ${t}_o WHERE m = ${t}.rowid)`,
    `DROP TABLE ${t}_o`,
    `CREATE INDEX ${t}_${column} ON ${t}(${column})`,
  ]),
  `DROP TABLE ${t}_s`,
  `CREATE UNIQUE INDEX ${t}_id ON ${t}(id)`,
];

const drops = (t: string) => ['', '_d', '_c', '_s', '_o'].map((suffix) => `DROP TABLE IF EXISTS ${t}${suffix}`);

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');
/** ",a,b," : `instr(list, ",a,")` finds a whole entry. */
const listOf = (values: Iterable<string>) => {
  const text = [...values].join(',');
  return text ? `,${text},` : '';
};

/** Upper-case three-letter codes from `ENG,GER`; empty for "all languages" (D-063, D-067). */
export const languageCodes = (languages: string | null | undefined) => [
  ...new Set(
    (languages ?? '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{3}$/.test(code)),
  ),
];

export const toCard = (master: Master): MasterCard => ({
  id: master.id,
  title: master.title,
  year: master.year,
  posterUrl: master.posterUrl,
  rating: master.rating,
  bestQuality: master.bestQuality,
  variantCount: master.variants.length,
});

/**
 * The library in SQLite (D-121): lists, categories, languages, hidden categories and search are queries, so a start
 * reads nothing but a few rows, and a list reads only its page. The same answers as the in-memory library
 * (`directApiClient`), except that titles order by their UTF-8 bytes, not UTF-16 units (they differ only between
 * characters outside the BMP and U+E000–U+FFFF).
 */
export function createSqlLibrary(db: SqlDatabase, pause: () => Promise<void>) {
  let ready: Promise<void> | null = null;
  /** Creates the table of contents once, and drops the tables of builds that never finished (the app was closed). */
  const prepare = () =>
    (ready ??= (async () => {
      await db.run([{ sql: META }]);
      const used = new Set((await db.query('SELECT tbl FROM library')).map((row) => String(row[0])));
      const orphans = (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'lib[0-9]*'"))
        .map((row) => String(row[0]))
        .filter((name) => !used.has(name.replace(/_[a-z]$/, '')));
      if (orphans.length) await db.run(orphans.map((name) => ({ sql: `DROP TABLE IF EXISTS ${name}` })));
    })().catch((error: unknown) => {
      ready = null;
      throw error;
    }));

  let lastTable = 0;
  const newTable = () => {
    lastTable = Math.max(lastTable + 1, Date.now());
    return `lib${lastTable}`;
  };

  /** A filter's total is the same for every page and order: counted once per library and filter. */
  const totals = new Map<string, number>();

  return {
    /** What the database holds for the account (no titles are read). */
    async open(account: string): Promise<Partial<Record<LibraryKind, SqlLibraryKind>>> {
      await prepare();
      const rows = await db.query('SELECT kind, tbl, built_at, rules, count, sorts, prefixes FROM library WHERE account = ?', [account]);
      const result: Partial<Record<LibraryKind, SqlLibraryKind>> = {};
      for (const [kind, table, builtAt, rules, count, sorts, prefixes] of rows) {
        result[kind as LibraryKind] = {
          table: String(table),
          builtAt: String(builtAt),
          current: Number(rules) === NORMALIZER_RULES,
          count: Number(count),
          sorts: JSON.parse(String(sorts)) as LibrarySort[],
          prefixes: JSON.parse(String(prefixes)) as string[],
        };
      }
      return result;
    },

    /**
     * Saves a new library of a kind (newest first) beside the current one, then switches to it in one step: a start
     * in between still finds the last complete library. Pauses between batches so the screen keeps running.
     */
    async save(account: string, kind: LibraryKind, builtAt: string, masters: Master[]): Promise<SqlLibraryKind> {
      await prepare();
      const t = newTable();
      const { packMaster, prefixes } = packer();
      try {
        await db.run(tables(t).map((sql) => ({ sql })));
        for (let start = 0; start < masters.length; start += WRITE_BATCH) {
          const rows: SqlValue[][] = [];
          const data: SqlValue[][] = [];
          const sorting: SqlValue[][] = [];
          const categories: SqlValue[][] = [];
          const end = Math.min(masters.length, start + WRITE_BATCH);
          for (let index = start; index < end; index++) {
            const master = masters[index]!;
            const m = index + 1;
            const cats = new Set<string>();
            const hints = new Set<string>();
            const codes = new Set<string>();
            for (const variant of master.variants) {
              if (variant.categoryId !== null) cats.add(variant.categoryId);
              for (const code of variant.audioLanguages) codes.add(code);
              for (const code of variant.subtitleLanguages) codes.add(code);
              if (!variant.audioLanguages.length && !variant.subtitleLanguages.length && variant.categoryId !== null)
                hints.add(variant.categoryId);
            }
            rows.push([
              m,
              master.id,
              master.title.toLowerCase(),
              master.normalizedKey,
              cats.size,
              listOf(cats),
              listOf(codes),
              listOf(hints),
            ]);
            data.push([m, JSON.stringify(packMaster(master))]);
            sorting.push([m, master.id, master.title, master.year, master.addedAt, master.releaseKey]);
            for (const cat of cats) categories.push([cat, m]);
          }
          await db.run([
            { sql: `INSERT INTO ${t} (rowid, id, lower, nkey, ncat, cats, langs, hints) VALUES (${placeholders(8)})`, rows },
            { sql: `INSERT INTO ${t}_d (m, data) VALUES (?, ?)`, rows: data },
            { sql: `INSERT INTO ${t}_s (m, id, title, year, added, released) VALUES (${placeholders(6)})`, rows: sorting },
            { sql: `INSERT INTO ${t}_c (cat, m) VALUES (?, ?)`, rows: categories },
          ]);
          await pause();
        }
        await db.run(finish(t).map((sql) => ({ sql })));
      } catch (error) {
        await db.run(drops(t).map((sql) => ({ sql }))).catch(() => undefined);
        throw error;
      }
      const sorts: LibrarySort[] = [];
      if (masters.some((master) => master.addedAt !== null)) sorts.push('added');
      sorts.push('title');
      if (masters.some((master) => master.releaseKey !== null)) sorts.push('released');
      const old = (await db.query('SELECT tbl FROM library WHERE account = ? AND kind = ?', [account, kind]))[0]?.[0];
      await db.run([
        { sql: 'DELETE FROM library WHERE account = ? AND kind = ?', rows: [[account, kind]] },
        {
          sql: 'INSERT INTO library (account, kind, tbl, built_at, rules, count, sorts, prefixes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          rows: [[account, kind, t, builtAt, NORMALIZER_RULES, masters.length, JSON.stringify(sorts), JSON.stringify(prefixes)]],
        },
      ]);
      // Lists still reading the old tables finish first; a start drops them if the app is closed before.
      if (old) setTimeout(() => void db.run(drops(String(old)).map((sql) => ({ sql }))).catch(() => undefined), RETIRE_MS);
      return { table: t, builtAt, current: true, count: masters.length, sorts, prefixes };
    },

    /** One page of a list: the same filters and orders as the in-memory library. */
    async list(saved: SqlLibraryKind, query: LibraryListQuery): Promise<LibraryPage> {
      const t = saved.table;
      const where: string[] = [];
      const params: SqlValue[] = [];
      const search = query.search?.trim().toLowerCase();
      if (query.categoryId) {
        where.push(`rowid IN (SELECT m FROM ${t}_c WHERE cat = ?)`);
        params.push(query.categoryId);
      }
      if (query.categoryIds) {
        if (query.categoryIds.length === 0) return { total: 0, items: [], sorts: saved.sorts };
        where.push(`rowid IN (SELECT m FROM ${t}_c WHERE cat IN (${placeholders(query.categoryIds.length)}))`);
        params.push(...query.categoryIds);
      }
      // Hidden categories (D-110): a title goes only when every one of its categories is hidden; search ignores them.
      const hidden = [...new Set(search ? [] : (query.hiddenCategoryIds ?? []))];
      if (hidden.length) {
        where.push(`(ncat = 0 OR ncat > ${hidden.map(() => '(instr(cats, ?) > 0)').join(' + ')})`);
        params.push(...hidden.map((id) => `,${id},`));
      }
      const codes = languageCodes(query.language);
      if (codes.length) {
        const hinted = [...new Set(query.languageCategoryIds ?? [])];
        where.push(`(${[...codes.map(() => 'instr(langs, ?) > 0'), ...hinted.map(() => 'instr(hints, ?) > 0')].join(' OR ')})`);
        params.push(...codes.map((code) => `,${code},`), ...hinted.map((id) => `,${id},`));
      }
      if (search) {
        where.push('(instr(nkey, ?) > 0 OR instr(lower, ?) > 0)');
        params.push(search, search);
      }
      const sort = query.sort ?? 'added';
      const order = query.order ?? (sort === 'title' ? 'asc' : 'desc');
      const orderBy = ORDERS[`${sort}|${order}`]?.column ?? 'rowid';
      const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
      const offset = Math.max(0, query.offset ?? 0);
      const limit = Math.min(500, Math.max(1, query.limit ?? 100));
      const totalKey = `${t}|${filter}|${JSON.stringify(params)}`;
      const [ids, total] = await Promise.all([
        db.query(`SELECT rowid FROM ${t}${filter} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]),
        where.length === 0
          ? saved.count
          : (totals.get(totalKey) ??
            db.query(`SELECT COUNT(*) FROM ${t}${filter}`, params).then((rows) => {
              const count = Number(rows[0]?.[0] ?? 0);
              if (totals.size > 200) totals.clear();
              totals.set(totalKey, count);
              return count;
            })),
      ]);
      const masters = await read(
        saved,
        ids.map((row) => Number(row[0])),
      );
      return { total, items: masters.map(toCard), sorts: saved.sorts };
    },

    async get(saved: SqlLibraryKind, id: string): Promise<Master | null> {
      const rows = await db.query(`SELECT data FROM ${saved.table}_d WHERE m = (SELECT rowid FROM ${saved.table} WHERE id = ?)`, [id]);
      const data = rows[0]?.[0];
      return typeof data === 'string' ? unpacker(saved.prefixes)(JSON.parse(data) as PackedMaster) : null;
    },

    /** Every title, newest first (an update reuses the unchanged ones, D-109). */
    async all(saved: SqlLibraryKind): Promise<Master[]> {
      const unpack = unpacker(saved.prefixes);
      const masters: Master[] = [];
      for (let after = 0; ;) {
        const rows = await db.query(`SELECT m, data FROM ${saved.table}_d WHERE m > ? ORDER BY m LIMIT ?`, [after, READ_BATCH]);
        for (const [, data] of rows) masters.push(unpack(JSON.parse(String(data)) as PackedMaster));
        if (rows.length < READ_BATCH) return masters;
        after = Number(rows[rows.length - 1]![0]);
        await pause();
      }
    },
  };

  /** The titles with these row numbers, in this order. */
  async function read(saved: SqlLibraryKind, rowids: number[]): Promise<Master[]> {
    if (rowids.length === 0) return [];
    const rows = await db.query(`SELECT m, data FROM ${saved.table}_d WHERE m IN (${placeholders(rowids.length)})`, rowids);
    const unpack = unpacker(saved.prefixes);
    const byRow = new Map(rows.map(([m, data]) => [Number(m), data]));
    return rowids.flatMap((m) => {
      const data = byRow.get(m);
      return typeof data === 'string' ? [unpack(JSON.parse(data) as PackedMaster)] : [];
    });
  }
}

export type SqlLibrary = ReturnType<typeof createSqlLibrary>;
