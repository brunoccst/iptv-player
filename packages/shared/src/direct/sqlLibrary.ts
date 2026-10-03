import type { LibraryListQuery } from '../api/apiClient';
import type { LibraryChanges, LibraryPage, LibrarySort, LiveChannel, MasterCard } from '../api/types';
import { NORMALIZER_RULES, unpacker, type PackedMaster } from './libraryCodec';
import { parseTitle } from './normalizer/parser';
import { masterIdText, qualityRank, qualityScore, savedItem, versionsOf, type Master, type NormalizerItem } from './normalizer/pipeline';
import { sha1Hex } from './normalizer/sha1';

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
  /** Saved before D-133: whole titles packed in `${table}_d`, not the provider's items. */
  packed: boolean;
  count: number;
  sorts: LibrarySort[];
  prefixes: string[];
}

/** Rows written per statement batch (one native call). */
const WRITE_BATCH = 1000;
/** How long the last build's tables stay after a new one is in place. */
const RETIRE_MS = 60_000;
/** Rows read per query when all of them are needed. */
const READ_BATCH = 5000;
/** Libraries built with these rules or later keep the provider's items and group them by query (D-133). */
const ITEM_RULES = 6;
/** Names not seen in any update for this long are forgotten. */
const NAME_KEEP_DAYS = 30;
/** What the parser read from each name (D-133). The same for every account; read again when the rules change. */
const NAMES = `title_names_${NORMALIZER_RULES}`;

const META = `CREATE TABLE IF NOT EXISTS library (
  account TEXT NOT NULL, kind TEXT NOT NULL, tbl TEXT NOT NULL, built_at TEXT NOT NULL, rules INTEGER NOT NULL,
  count INTEGER NOT NULL, sorts TEXT NOT NULL, prefixes TEXT NOT NULL, PRIMARY KEY (account, kind))`;

const NAMES_TABLE = `CREATE TABLE IF NOT EXISTS ${NAMES} (name TEXT PRIMARY KEY, title TEXT NOT NULL, nkey TEXT NOT NULL,
  nyear INTEGER, quality TEXT, source TEXT, audio TEXT NOT NULL, atag TEXT, hdr INTEGER NOT NULL, subs TEXT NOT NULL,
  score INTEGER NOT NULL, qrank INTEGER NOT NULL, langs TEXT NOT NULL, seen INTEGER NOT NULL) WITHOUT ROWID`;

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
 * A library is the provider's items, grouped into titles by queries (D-133). Its tables:
 * - `${t}_i`: the items, with what the parser read from their names and the title (`g`) each is in.
 * - `${t}`: one row per title (rowid: newest first), with what lists show, filter, search and sort on. `cats`, `langs`
 *   and `hints` are lists like ",10,11,": the title's categories, its audio and subtitle languages, and the categories
 *   of its versions without a language (the category hint, D-086).
 * - `${t}_c`: title by category, for category pages and Kids profiles.
 * While building: `_r` (the items as downloaded), `_y`, `_t`, `_g` (grouping) and `_a` (the titles, before ordering).
 */
const ITEM_COLUMNS = `sid TEXT NOT NULL, name TEXT NOT NULL, cat TEXT, poster TEXT, rating REAL, added INTEGER, released INTEGER,
  ext TEXT, tmdb TEXT, ryear INTEGER`;

const TITLE_COLUMNS = `g INTEGER NOT NULL, id TEXT, lower TEXT, title TEXT NOT NULL, nkey TEXT, year INTEGER, poster TEXT,
  rating REAL, best TEXT, n INTEGER NOT NULL, added INTEGER, released INTEGER, ncat INTEGER NOT NULL, cats TEXT NOT NULL,
  langs TEXT NOT NULL, hints TEXT NOT NULL, sig TEXT NOT NULL`;
const TITLE_NAMES = 'g, id, lower, title, nkey, year, poster, rating, best, n, added, released, ncat, cats, langs, hints, sig';

/** The most common value among a title's items; ties go to its best item, then the smallest stream id (D-133). */
const mostCommon = (t: string, column: string) =>
  `(SELECT ${column} FROM ${t}_i x WHERE x.g = i.g AND ${column} IS NOT NULL GROUP BY ${column}
    ORDER BY count(*) DESC, max(score) DESC, min(sid) LIMIT 1)`;

/**
 * Grouping (D-133), one step per call so no call holds the database (on desktop: the main process) for long:
 * 1. Same compact key (the key without spaces) and year. A year-less item takes its key's year when the key has
 *    exactly one.
 * 2. Each key takes the smallest TMDB id among its items; items with one group by it and the year instead (D-065).
 * The same rules as `groupTitles` (the library in memory).
 */
const grouping = (t: string): string[][] => [
  [
    `CREATE TABLE ${t}_i (${ITEM_COLUMNS}, title TEXT NOT NULL, nkey TEXT NOT NULL, ckey TEXT NOT NULL, year INTEGER,
      nyear INTEGER, quality TEXT, source TEXT, audio TEXT NOT NULL, atag TEXT, hdr INTEGER NOT NULL, subs TEXT NOT NULL,
      score INTEGER NOT NULL, qrank INTEGER NOT NULL, langs TEXT NOT NULL, gyear INTEGER, k TEXT, tm TEXT, gk TEXT, g INTEGER)`,
    `INSERT INTO ${t}_i (sid, name, cat, poster, rating, added, released, ext, tmdb, ryear, title, nkey, ckey, year, nyear,
      quality, source, audio, atag, hdr, subs, score, qrank, langs)
      SELECT r.sid, r.name, r.cat, r.poster, r.rating, r.added, r.released, r.ext, r.tmdb, r.ryear, n.title, n.nkey,
        replace(n.nkey, ' ', ''), IFNULL(n.nyear, r.ryear), n.nyear, n.quality, n.source, n.audio, n.atag, n.hdr, n.subs,
        n.score, n.qrank, n.langs
      FROM ${t}_r r JOIN ${NAMES} n ON n.name = r.name ORDER BY r.rowid`,
    `DROP TABLE ${t}_r`,
  ],
  [
    `CREATE TABLE ${t}_y (ckey TEXT PRIMARY KEY, y INTEGER NOT NULL) WITHOUT ROWID`,
    `INSERT INTO ${t}_y (ckey, y) SELECT ckey, min(year) FROM ${t}_i WHERE year IS NOT NULL GROUP BY ckey
      HAVING count(DISTINCT year) = 1`,
    `UPDATE ${t}_i SET gyear = IFNULL(year, (SELECT y FROM ${t}_y WHERE ckey = ${t}_i.ckey))`,
    `UPDATE ${t}_i SET k = ckey || '|' || IFNULL(gyear, '')`,
  ],
  [
    `CREATE TABLE ${t}_t (k TEXT PRIMARY KEY, tm TEXT NOT NULL) WITHOUT ROWID`,
    `INSERT INTO ${t}_t (k, tm) SELECT k, min(tmdb) FROM ${t}_i WHERE tmdb IS NOT NULL GROUP BY k`,
    `UPDATE ${t}_i SET tm = (SELECT tm FROM ${t}_t WHERE k = ${t}_i.k)`,
    `UPDATE ${t}_i SET gk = CASE WHEN tm IS NULL THEN 'k' || k ELSE 't' || tm || '|' || IFNULL(gyear, '') END`,
  ],
  [
    `CREATE TABLE ${t}_g (g INTEGER PRIMARY KEY, gk TEXT NOT NULL UNIQUE)`,
    `INSERT INTO ${t}_g (gk) SELECT gk FROM ${t}_i GROUP BY gk ORDER BY min(rowid)`,
    `UPDATE ${t}_i SET g = (SELECT g FROM ${t}_g WHERE gk = ${t}_i.gk)`,
    `CREATE INDEX ${t}_ig ON ${t}_i(g)`,
    `DROP TABLE ${t}_y`,
    `DROP TABLE ${t}_t`,
    `DROP TABLE ${t}_g`,
  ],
  // What each title shows: its most common spelling and year, its best version's poster and quality (D-133).
  [
    `CREATE TABLE ${t}_a (${TITLE_COLUMNS})`,
    `INSERT INTO ${t}_a (g, title, year, poster, rating, best, n, added, released, ncat, cats, langs, hints, sig)
      SELECT g, ${mostCommon(t, 'title')}, ${mostCommon(t, 'year')},
        (SELECT poster FROM ${t}_i x WHERE x.g = i.g AND poster IS NOT NULL ORDER BY score DESC, sid LIMIT 1),
        max(rating),
        (SELECT quality FROM ${t}_i x WHERE x.g = i.g AND quality IS NOT NULL ORDER BY qrank DESC, score DESC, sid LIMIT 1),
        count(*), max(added), min(released), count(DISTINCT cat),
        IFNULL(',' || group_concat(DISTINCT cat) || ',', ''),
        IFNULL(',' || group_concat(DISTINCT CASE WHEN langs <> '' THEN substr(langs, 2, length(langs) - 2) END) || ',', ''),
        IFNULL(',' || group_concat(DISTINCT CASE WHEN langs = '' THEN cat END) || ',', ''),
        count(*) || '|' || sum(length(name)) || '|' || total(rating) || '|' || IFNULL(max(added), '') || '|' ||
          count(DISTINCT cat) || '|' || sum(length(IFNULL(poster, '')))
      FROM ${t}_i i GROUP BY g`,
    `UPDATE ${t}_a SET nkey = (SELECT nkey FROM ${t}_i x WHERE x.g = ${t}_a.g AND x.title = ${t}_a.title LIMIT 1),
      released = IFNULL(released, year * 10000)`,
    `CREATE UNIQUE INDEX ${t}_ag ON ${t}_a(g)`,
  ],
];

/** After the ids: the titles newest first, each order's numbers (a sorted copy's row numbers) and the indexes. */
const finish = (t: string): string[][] => [
  [
    `CREATE TABLE ${t} (${TITLE_COLUMNS}, a0 INTEGER, r1 INTEGER, r0 INTEGER, t0 INTEGER, t1 INTEGER)`,
    `INSERT INTO ${t} (${TITLE_NAMES}) SELECT ${TITLE_NAMES} FROM ${t}_a ORDER BY ${'added IS NULL, added DESC, title, IFNULL(year, -1), id'}`,
    `DROP TABLE ${t}_a`,
    `CREATE UNIQUE INDEX ${t}_g ON ${t}(g)`,
    `CREATE INDEX ${t}_id ON ${t}(id)`,
  ],
  [
    `CREATE TABLE ${t}_c (cat TEXT NOT NULL, m INTEGER NOT NULL, PRIMARY KEY (cat, m)) WITHOUT ROWID`,
    `INSERT INTO ${t}_c (cat, m) SELECT DISTINCT i.cat, a.rowid FROM ${t}_i i JOIN ${t} a ON a.g = i.g WHERE i.cat IS NOT NULL`,
  ],
  ...Object.values(ORDERS).map(({ column, by }) => [
    `CREATE TABLE ${t}_o (m INTEGER NOT NULL)`,
    `INSERT INTO ${t}_o (m) SELECT rowid FROM ${t} ORDER BY ${by}`,
    `CREATE UNIQUE INDEX ${t}_om ON ${t}_o(m)`,
    `UPDATE ${t} SET ${column} = (SELECT rowid FROM ${t}_o WHERE m = ${t}.rowid)`,
    `DROP TABLE ${t}_o`,
    `CREATE INDEX ${t}_${column} ON ${t}(${column})`,
  ]),
];

const drops = (t: string) =>
  ['', '_d', '_c', '_s', '_o', '_r', '_i', '_y', '_t', '_g', '_a'].map((suffix) => `DROP TABLE IF EXISTS ${t}${suffix}`);

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');
/** ",a,b," : `instr(list, ",a,")` finds a whole entry. */
const listOf = (values: Iterable<string>) => {
  const text = [...values].join(',');
  return text ? `,${text},` : '';
};
const codesOf = (value: SqlValue | undefined) => (value ? String(value).split(',') : []);
const textOrNull = (value: SqlValue | undefined) => (value === null || value === undefined ? null : String(value));
const numberOrNull = (value: SqlValue | undefined) => (value === null || value === undefined ? null : Number(value));

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

/** Table names from the clock, never the same twice in a run (the library and the channels share them). */
let lastTable = 0;
const newTable = () => {
  lastTable = Math.max(lastTable + 1, Date.now());
  return `lib${lastTable}`;
};

export interface LibraryBuildOptions {
  /** SHA-1 hex of each text, all at once (TV/phone: native code, D-118); otherwise hashed here. */
  hashIds?(texts: string[]): Promise<string[]>;
  /** Names read so far, of the names not read before. */
  onNames?(done: number, total: number): void;
  /** Milliseconds per step, for the Log (D-116). */
  onTimings?(timings: LibraryBuildTimings): void;
  /** Milliseconds of parsing between breaks for the screen. */
  sliceMs?: number;
}

export interface LibraryBuildTimings {
  /** Saving the provider's items. */
  items: number;
  /** Reading the names not seen before, and how many. */
  names: number;
  newNames: number;
  /** The grouping queries. */
  grouping: number;
  /** The titles' ids. */
  ids: number;
  /** The orders, indexes and categories. */
  orders: number;
}

/**
 * The library in SQLite (D-121): lists, categories, languages, hidden categories and search are queries, so a start
 * reads nothing but a few rows, and a list reads only its page. Since D-133 the provider's items are saved as they come
 * and grouped into titles by queries; only names not seen before are read (parsed) here. The same answers as the
 * in-memory library (`directApiClient`), except that titles order by their UTF-8 bytes, not UTF-16 units (they differ
 * only between characters outside the BMP and U+E000–U+FFFF).
 */
export function createSqlLibrary(db: SqlDatabase, pause: () => Promise<void>) {
  let ready: Promise<void> | null = null;
  /**
   * Creates the table of contents and the names once, and drops the tables of builds that never finished (the app was
   * closed) and the names read with older rules.
   */
  const prepare = () =>
    (ready ??= (async () => {
      await db.run([{ sql: META }, { sql: NAMES_TABLE }]);
      const used = new Set((await db.query('SELECT tbl FROM library')).map((row) => String(row[0])));
      const orphans = (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'lib[0-9]*'"))
        .map((row) => String(row[0]))
        .filter((name) => !used.has(name.replace(/_[a-z]$/, '')));
      const oldNames = (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'title_names_*'"))
        .map((row) => String(row[0]))
        .filter((name) => name !== NAMES);
      if (orphans.length || oldNames.length)
        await db.run([...orphans, ...oldNames].map((name) => ({ sql: `DROP TABLE IF EXISTS ${name}` })));
    })().catch((error: unknown) => {
      ready = null;
      throw error;
    }));

  /** A filter's total is the same for every page and order: counted once per library and filter. */
  const totals = new Map<string, number>();

  /** Runs each step as one call, with a break for the screen after each. */
  const steps = async (list: string[][]) => {
    for (const step of list) {
      await db.run(step.map((sql) => ({ sql })));
      await pause();
    }
  };

  return {
    /** What the database holds for the account (no titles are read). */
    async open(account: string): Promise<Partial<Record<LibraryKind, SqlLibraryKind>>> {
      await prepare();
      const rows = await db.query(
        "SELECT kind, tbl, built_at, rules, count, sorts, prefixes FROM library WHERE account = ? AND kind IN ('movie', 'series')",
        [account],
      );
      const result: Partial<Record<LibraryKind, SqlLibraryKind>> = {};
      for (const [kind, table, builtAt, rules, count, sorts, prefixes] of rows) {
        result[kind as LibraryKind] = {
          table: String(table),
          builtAt: String(builtAt),
          current: Number(rules) === NORMALIZER_RULES,
          packed: Number(rules) < ITEM_RULES,
          count: Number(count),
          sorts: JSON.parse(String(sorts)) as LibrarySort[],
          prefixes: JSON.parse(String(prefixes)) as string[],
        };
      }
      return result;
    },

    /**
     * Saves the provider's items of a kind and groups them into titles (D-133), beside the current library, then
     * switches to it in one step: a start in between still finds the last complete library. Only names not seen
     * before are read. Also says what changed against the last library (D-119).
     */
    async build(
      account: string,
      kind: LibraryKind,
      builtAt: string,
      items: NormalizerItem[],
      options: LibraryBuildOptions = {},
    ): Promise<{ saved: SqlLibraryKind; changes: LibraryChanges | null }> {
      await prepare();
      const t = newTable();
      const timings: LibraryBuildTimings = { items: 0, names: 0, newNames: 0, grouping: 0, ids: 0, orders: 0 };
      let stepStarted = Date.now();
      const took = (step: Exclude<keyof LibraryBuildTimings, 'newNames'>) => {
        timings[step] = Date.now() - stepStarted;
        stepStarted = Date.now();
      };
      const old = (await db.query('SELECT tbl, rules FROM library WHERE account = ? AND kind = ?', [account, kind]))[0];
      let count: number;
      let added = false;
      let released: boolean;
      try {
        await db.run([{ sql: `CREATE TABLE ${t}_r (${ITEM_COLUMNS})` }]);
        for (let start = 0; start < items.length; start += WRITE_BATCH) {
          const rows: SqlValue[][] = [];
          for (const item of items.slice(start, start + WRITE_BATCH)) {
            const saved = savedItem(item);
            if (!saved) continue;
            added ||= saved.addedAt !== null;
            rows.push([
              saved.streamId,
              saved.name,
              saved.categoryId,
              saved.posterUrl,
              saved.rating,
              saved.addedAt,
              saved.released,
              saved.containerExtension,
              saved.tmdbId,
              saved.releaseYear,
            ]);
          }
          if (rows.length)
            await db.run([
              {
                sql: `INSERT INTO ${t}_r (sid, name, cat, poster, rating, added, released, ext, tmdb, ryear) VALUES (${placeholders(10)})`,
                rows,
              },
            ]);
          await pause();
        }
        took('items');
        await readNewNames(t, options, timings);
        took('names');
        await steps(grouping(t));
        took('grouping');
        count = await titleIds(t, account, kind, options.hashIds);
        released = (await db.query(`SELECT 1 FROM ${t}_a WHERE released IS NOT NULL LIMIT 1`)).length > 0;
        took('ids');
        await steps(finish(t));
        took('orders');
      } catch (error) {
        await db.run(drops(t).map((sql) => ({ sql }))).catch(() => undefined);
        throw error;
      }
      options.onTimings?.(timings);
      const changes = old ? await changesSince(String(old[0]), Number(old[1]) < ITEM_RULES, t, count).catch(() => null) : null;
      const sorts: LibrarySort[] = [];
      if (added) sorts.push('added');
      sorts.push('title');
      if (released) sorts.push('released');
      await db.run([
        { sql: 'DELETE FROM library WHERE account = ? AND kind = ?', rows: [[account, kind]] },
        {
          sql: "INSERT INTO library (account, kind, tbl, built_at, rules, count, sorts, prefixes) VALUES (?, ?, ?, ?, ?, ?, ?, '[]')",
          rows: [[account, kind, t, builtAt, NORMALIZER_RULES, count, JSON.stringify(sorts)]],
        },
      ]);
      // Lists still reading the old tables finish first; a start drops them if the app is closed before.
      if (old) setTimeout(() => void db.run(drops(String(old[0])).map((sql) => ({ sql }))).catch(() => undefined), RETIRE_MS);
      return { saved: { table: t, builtAt, current: true, packed: false, count, sorts, prefixes: [] }, changes };
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
      const columns = saved.packed ? 'rowid' : 'id, title, year, poster, rating, best, n';
      const [rows, total] = await Promise.all([
        db.query(`SELECT ${columns} FROM ${t}${filter} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]),
        where.length === 0
          ? saved.count
          : (totals.get(totalKey) ??
            db.query(`SELECT COUNT(*) FROM ${t}${filter}`, params).then((counted) => {
              const count = Number(counted[0]?.[0] ?? 0);
              if (totals.size > 200) totals.clear();
              totals.set(totalKey, count);
              return count;
            })),
      ]);
      const items = saved.packed
        ? (
            await readPacked(
              saved,
              rows.map((row) => Number(row[0])),
            )
          ).map(toCard)
        : rows.map(([id, title, year, poster, rating, best, n]): MasterCard => ({
            id: String(id),
            title: String(title),
            year: numberOrNull(year),
            posterUrl: textOrNull(poster),
            rating: numberOrNull(rating),
            bestQuality: textOrNull(best),
            variantCount: Number(n),
          }));
      return { total, items, sorts: saved.sorts };
    },

    async get(saved: SqlLibraryKind, id: string): Promise<Master | null> {
      const t = saved.table;
      if (saved.packed) {
        const rows = await db.query(`SELECT data FROM ${t}_d WHERE m = (SELECT rowid FROM ${t} WHERE id = ?)`, [id]);
        const data = rows[0]?.[0];
        return typeof data === 'string' ? unpacker(saved.prefixes)(JSON.parse(data) as PackedMaster) : null;
      }
      const head = (await db.query(`SELECT g, title, nkey, year, poster, rating, best, added, released FROM ${t} WHERE id = ?`, [id]))[0];
      if (!head) return null;
      const [g = null, title, nkey, year, poster, rating, best, addedAt, released] = head;
      const items = await db.query(
        `SELECT sid, name, cat, poster, rating, ext, title, nkey, nyear, quality, source, audio, atag, hdr, subs FROM ${t}_i WHERE g = ?`,
        [g],
      );
      return {
        id,
        title: String(title),
        normalizedKey: String(nkey),
        year: numberOrNull(year),
        posterUrl: textOrNull(poster),
        rating: numberOrNull(rating),
        bestQuality: textOrNull(best),
        addedAt: numberOrNull(addedAt),
        releaseKey: numberOrNull(released),
        variants: versionsOf(
          items.map(([sid, name, cat, itemPoster, itemRating, ext, clean, key, nyear, quality, source, audio, atag, hdr, subs]) => ({
            item: {
              id: String(sid),
              name: String(name),
              categoryId: textOrNull(cat),
              posterUrl: textOrNull(itemPoster),
              rating: numberOrNull(itemRating),
              containerExtension: textOrNull(ext),
            },
            title: {
              raw: String(name),
              cleanTitle: String(clean),
              key: String(key),
              year: numberOrNull(nyear),
              quality: textOrNull(quality),
              source: textOrNull(source),
              audioLanguages: codesOf(audio),
              audioTag: textOrNull(atag),
              isHdr: Number(hdr) === 1,
              subtitleLanguages: codesOf(subs),
            },
          })),
        ),
      };
    },
  };

  /** Reads the names no library had before (in slices, so the screen keeps running) and keeps what they say. */
  async function readNewNames(t: string, options: LibraryBuildOptions, timings: LibraryBuildTimings) {
    const today = Math.floor(Date.now() / 86_400_000);
    const names = (
      await db.query(`SELECT DISTINCT name FROM ${t}_r WHERE NOT EXISTS (SELECT 1 FROM ${NAMES} n WHERE n.name = ${t}_r.name)`)
    ).map((row) => String(row[0]));
    timings.newNames = names.length;
    const sliceMs = options.sliceMs ?? 250;
    let rows: SqlValue[][] = [];
    let sliceStarted = Date.now();
    for (let index = 0; index < names.length; index++) {
      const name = names[index]!;
      const title = parseTitle(name);
      rows.push([
        name,
        title.cleanTitle,
        title.key,
        title.year,
        title.quality,
        title.source,
        title.audioLanguages.join(','),
        title.audioTag,
        title.isHdr ? 1 : 0,
        title.subtitleLanguages.join(','),
        qualityScore(title),
        title.quality ? qualityRank(title.quality) : 0,
        listOf([...title.audioLanguages, ...title.subtitleLanguages]),
        today,
      ]);
      const last = index === names.length - 1;
      if (rows.length >= WRITE_BATCH || last) {
        await db.run([
          {
            sql: `INSERT OR REPLACE INTO ${NAMES} (name, title, nkey, nyear, quality, source, audio, atag, hdr, subs, score, qrank,
              langs, seen) VALUES (${placeholders(14)})`,
            rows,
          },
        ]);
        rows = [];
      }
      if (last || Date.now() - sliceStarted >= sliceMs) {
        options.onNames?.(index + 1, names.length);
        await pause();
        sliceStarted = Date.now();
      }
    }
    // Names seen today stay; names no update has seen for a while go.
    await db.run([
      { sql: `UPDATE ${NAMES} SET seen = ? WHERE seen < ? AND name IN (SELECT name FROM ${t}_r)`, rows: [[today, today]] },
      { sql: `DELETE FROM ${NAMES} WHERE seen < ?`, rows: [[today - NAME_KEEP_DAYS]] },
    ]);
  }

  /** Each title's id (the same as a title built in memory) and lower-case title; how many titles there are. */
  async function titleIds(t: string, account: string, kind: LibraryKind, hashIds: LibraryBuildOptions['hashIds']) {
    let count = 0;
    for (let after = 0; ;) {
      const rows = await db.query(`SELECT g, nkey, year, title FROM ${t}_a WHERE g > ? ORDER BY g LIMIT ?`, [after, READ_BATCH]);
      const texts = rows.map(([, nkey, year]) => masterIdText(account, kind, String(nkey).replaceAll(' ', ''), numberOrNull(year)));
      const hashed = hashIds ? await hashIds(texts) : texts.map(sha1Hex);
      await db.run([
        {
          sql: `UPDATE ${t}_a SET id = ?, lower = ? WHERE g = ?`,
          rows: rows.map(([g, , , title], index) => [hashed[index]!.slice(0, 20), String(title).toLowerCase(), g ?? null]),
        },
      ]);
      count += rows.length;
      await pause();
      if (rows.length < READ_BATCH) return count;
      after = Number(rows[rows.length - 1]![0]);
    }
  }

  /**
   * Titles added, changed and removed against the last library (D-119). Changed: a title with the same id whose
   * versions, names, rating, categories or posters are not the same. A library saved before D-133 only tells added and
   * removed.
   */
  async function changesSince(old: string, packed: boolean, t: string, count: number): Promise<LibraryChanges> {
    const before = Number((await db.query(`SELECT COUNT(*) FROM ${old}`))[0]?.[0] ?? 0);
    const kept = Number((await db.query(`SELECT COUNT(*) FROM ${t} WHERE id IN (SELECT id FROM ${old})`))[0]?.[0] ?? 0);
    const changed = packed
      ? 0
      : Number((await db.query(`SELECT COUNT(*) FROM ${t} a JOIN ${old} b ON b.id = a.id WHERE a.sig <> b.sig`))[0]?.[0] ?? 0);
    return { added: count - kept, changed, removed: Math.max(0, before - kept) };
  }

  /** Titles saved before D-133 with these row numbers, in this order. */
  async function readPacked(saved: SqlLibraryKind, rowids: number[]): Promise<Master[]> {
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

/** An account's live channels in the database (D-123). */
export interface SqlLiveChannels {
  table: string;
  builtAt: string;
  count: number;
}

export interface LiveChannelQuery {
  categoryId?: string | null;
  /** Only these categories (Kids profiles). */
  categoryIds?: string[] | null;
  /** Leaves out channels in these categories (hidden by the profile, D-110). */
  hiddenCategoryIds?: string[] | null;
  /** Part of the name, any case. */
  search?: string | null;
  offset?: number;
  /** Without a limit: every matching channel. */
  limit?: number;
}

/** Channels saved per statement batch (one native call). */
const CHANNEL_BATCH = 2000;

/**
 * Live channels in SQLite (D-123): providers list 20,000+ channels, and the guide, a category and a search each want a
 * few of them. The whole list is downloaded now and then (daily, and with "Update library") and saved here in the
 * provider's order; each screen then asks for its page. Tables are named like the library's (`lib…`), listed in the
 * same table of contents (kind "live"), so an unfinished save is dropped at the next start the same way.
 */
export function createSqlLiveChannels(db: SqlDatabase, library: SqlLibrary, pause: () => Promise<void>) {
  const totals = new Map<string, number>();
  return {
    async open(account: string): Promise<SqlLiveChannels | null> {
      await library.open(account); // Creates the table of contents and drops unfinished saves.
      const row = (await db.query("SELECT tbl, built_at, count FROM library WHERE account = ? AND kind = 'live'", [account]))[0];
      return row ? { table: String(row[0]), builtAt: String(row[1]), count: Number(row[2]) } : null;
    },

    /** Saves the whole list beside the current one, then switches to it in one step. */
    async save(account: string, builtAt: string, channels: LiveChannel[]): Promise<SqlLiveChannels> {
      await library.open(account);
      const t = newTable();
      try {
        await db.run([
          {
            sql: `CREATE TABLE ${t} (id TEXT NOT NULL, name TEXT NOT NULL, lower TEXT NOT NULL, cat TEXT, num INTEGER, logo TEXT,
              epg TEXT, catchup INTEGER NOT NULL)`,
          },
        ]);
        for (let start = 0; start < channels.length; start += CHANNEL_BATCH) {
          const rows = channels
            .slice(start, start + CHANNEL_BATCH)
            .map((channel, index): SqlValue[] => [
              start + index + 1,
              channel.id,
              channel.name,
              channel.name.toLowerCase(),
              channel.categoryId,
              channel.number,
              channel.logoUrl,
              channel.epgChannelId,
              channel.hasCatchup ? 1 : 0,
            ]);
          await db.run([
            { sql: `INSERT INTO ${t} (rowid, id, name, lower, cat, num, logo, epg, catchup) VALUES (${placeholders(9)})`, rows },
          ]);
          await pause();
        }
        await db.run([{ sql: `CREATE INDEX ${t}_cat ON ${t}(cat)` }]);
      } catch (error) {
        await db.run([{ sql: `DROP TABLE IF EXISTS ${t}` }]).catch(() => undefined);
        throw error;
      }
      const old = (await db.query("SELECT tbl FROM library WHERE account = ? AND kind = 'live'", [account]))[0]?.[0];
      await db.run([
        { sql: "DELETE FROM library WHERE account = ? AND kind = 'live'", rows: [[account]] },
        {
          sql: "INSERT INTO library (account, kind, tbl, built_at, rules, count, sorts, prefixes) VALUES (?, 'live', ?, ?, 0, ?, '[]', '[]')",
          rows: [[account, t, builtAt, channels.length]],
        },
      ]);
      if (old) setTimeout(() => void db.run([{ sql: `DROP TABLE IF EXISTS ${String(old)}` }]).catch(() => undefined), RETIRE_MS);
      return { table: t, builtAt, count: channels.length };
    },

    /** Matching channels in the provider's order, and how many match in all. */
    async list(saved: SqlLiveChannels, query: LiveChannelQuery): Promise<{ total: number; channels: LiveChannel[] }> {
      const t = saved.table;
      const where: string[] = [];
      const params: SqlValue[] = [];
      if (query.categoryId) {
        where.push('cat = ?');
        params.push(query.categoryId);
      }
      if (query.categoryIds) {
        if (query.categoryIds.length === 0) return { total: 0, channels: [] };
        where.push(`cat IN (${placeholders(query.categoryIds.length)})`);
        params.push(...query.categoryIds);
      }
      if (query.hiddenCategoryIds?.length) {
        where.push(`(cat IS NULL OR cat NOT IN (${placeholders(query.hiddenCategoryIds.length)}))`);
        params.push(...query.hiddenCategoryIds);
      }
      const search = query.search?.trim().toLowerCase();
      if (search) {
        where.push('instr(lower, ?) > 0');
        params.push(search);
      }
      const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
      const offset = Math.max(0, query.offset ?? 0);
      const limit = query.limit === undefined ? -1 : Math.max(1, query.limit);
      const totalKey = `${t}|${filter}|${JSON.stringify(params)}`;
      const [rows, total] = await Promise.all([
        db.query(`SELECT id, name, cat, num, logo, epg, catchup FROM ${t}${filter} ORDER BY rowid LIMIT ? OFFSET ?`, [
          ...params,
          limit,
          offset,
        ]),
        where.length === 0
          ? saved.count
          : (totals.get(totalKey) ??
            db.query(`SELECT COUNT(*) FROM ${t}${filter}`, params).then((counted) => {
              const count = Number(counted[0]?.[0] ?? 0);
              if (totals.size > 200) totals.clear();
              totals.set(totalKey, count);
              return count;
            })),
      ]);
      const channels = rows.map(([id, name, categoryId, number, logoUrl, epgChannelId, catchup]): LiveChannel => ({
        id: String(id),
        name: String(name),
        categoryId: categoryId === null ? null : String(categoryId),
        number: number === null ? null : Number(number),
        logoUrl: logoUrl === null ? null : String(logoUrl),
        epgChannelId: epgChannelId === null ? null : String(epgChannelId),
        hasCatchup: Number(catchup) === 1,
      }));
      return { total, channels };
    },
  };
}

export type SqlLive = ReturnType<typeof createSqlLiveChannels>;
