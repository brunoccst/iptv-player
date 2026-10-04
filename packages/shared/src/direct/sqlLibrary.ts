import type { LibraryListQuery } from '../api/apiClient';
import type { LibraryChanges, LibraryPage, LibrarySort, LiveChannel, MasterCard, ProgrammeMatch } from '../api/types';
import type { GuideProgramme } from './xmltv';
import { NORMALIZER_RULES, unpacker, type PackedMaster } from './libraryCodec';
import { compactKey, parseTitle } from './normalizer/parser';
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
  /**
   * The orders made so far, each a table of row numbers (`${table}_o<column>`, D-135); null for a library that keeps
   * them as columns (built before D-135).
   */
  orders: string[] | null;
}

/** Rows written per statement batch (one native call). */
const WRITE_BATCH = 1000;
/** How long the last build's tables stay after a new one is in place. */
const RETIRE_MS = 60_000;
/**
 * An update changes the library in place when at most this share of the items is grouped again (D-137); more, and a new
 * library is built beside it.
 */
const IN_PLACE_SHARE = 0.2;
/** The grouping steps that group the changed keys (`_p` to `_g`), before the items are written. */
const GROUPED_KEYS = 4;
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
  count INTEGER NOT NULL, sorts TEXT NOT NULL, prefixes TEXT NOT NULL, orders TEXT, PRIMARY KEY (account, kind))`;

const NAMES_TABLE = `CREATE TABLE IF NOT EXISTS ${NAMES} (name TEXT PRIMARY KEY, title TEXT NOT NULL, nkey TEXT NOT NULL, ckey TEXT NOT NULL,
  nyear INTEGER, quality TEXT, source TEXT, audio TEXT NOT NULL, atag TEXT, hdr INTEGER NOT NULL, subs TEXT NOT NULL,
  score INTEGER NOT NULL, qrank INTEGER NOT NULL, langs TEXT NOT NULL, seen INTEGER NOT NULL) WITHOUT ROWID`;

/** The row order of a library's titles: newest first (D-049), the order Home and the lists ask for first. */
const NEWEST_FIRST = 'added IS NULL, added DESC, title, IFNULL(year, -1), id';
/**
 * Newest first as an order table: titles an update adds in place come at the end, so from then on the row order is not
 * newest first (D-137).
 */
const NEWEST = { column: 'n1', by: NEWEST_FIRST };

/**
 * The other list orders (D-049): missing values last, then title, year and id. Each is a table of row numbers in that
 * order, made the first time a list asks for it (D-135); libraries built before D-135 keep a number per title instead.
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
 * - `${t}_o<column>`: one per order other than newest first, once asked for (D-135); `_on1`, newest first, once the
 *   library was updated in place (D-137).
 * While building: `_r` (the items as downloaded), `_x`, `_k` (what changed), `_p`, `_y`, `_t`, `_g` (grouping), `_a` and
 * `_e` (the new titles and their ids), `_z` (the titles an update in place replaces).
 */
const ITEM_COLUMNS = `sid TEXT NOT NULL, name TEXT NOT NULL, cat TEXT, poster TEXT, rating REAL, added INTEGER, released INTEGER,
  ext TEXT, tmdb TEXT, ryear INTEGER`;

/** The items with what the parser read from their names and their title (`g`): `${t}_i`. */
const GROUPED_COLUMNS = `${ITEM_COLUMNS}, title TEXT NOT NULL, nkey TEXT NOT NULL, ckey TEXT NOT NULL, year INTEGER,
  nyear INTEGER, quality TEXT, source TEXT, audio TEXT NOT NULL, atag TEXT, hdr INTEGER NOT NULL, subs TEXT NOT NULL,
  score INTEGER NOT NULL, qrank INTEGER NOT NULL, langs TEXT NOT NULL, gyear INTEGER, k TEXT, tm TEXT, gk TEXT, g INTEGER`;
const GROUPED_NAMES = `sid, name, cat, poster, rating, added, released, ext, tmdb, ryear, title, nkey, ckey, year, nyear,
  quality, source, audio, atag, hdr, subs, score, qrank, langs, gyear, k, tm, gk, g`;
/** A downloaded item (`r`) with what the parser read from its name (`n`): the grouped columns up to `langs`. */
const READ_ITEM = `r.sid, r.name, r.cat, r.poster, r.rating, r.added, r.released, r.ext, r.tmdb, r.ryear, n.title, n.nkey,
  n.ckey, IFNULL(n.nyear, r.ryear), n.nyear, n.quality, n.source, n.audio, n.atag, n.hdr, n.subs, n.score, n.qrank, n.langs`;

const TITLE_COLUMNS = `g INTEGER NOT NULL, id TEXT, lower TEXT, title TEXT NOT NULL, nkey TEXT, ckey TEXT, year INTEGER, poster TEXT,
  rating REAL, best TEXT, n INTEGER NOT NULL, added INTEGER, released INTEGER, ncat INTEGER NOT NULL, cats TEXT NOT NULL,
  langs TEXT NOT NULL, hints TEXT NOT NULL, sig TEXT NOT NULL`;
const TITLE_NAMES = 'g, id, lower, title, nkey, ckey, year, poster, rating, best, n, added, released, ncat, cats, langs, hints, sig';

/** The most common value among a title's items; ties go to its best item, then the smallest stream id (D-133). */
const mostCommon = (t: string, column: string) =>
  `(SELECT ${column} FROM ${t}_i x WHERE x.g = i.g AND ${column} IS NOT NULL GROUP BY ${column}
    ORDER BY count(*) DESC, max(score) DESC, min(sid) LIMIT 1)`;

/** The columns an item is compared on with the last library's (D-135): what the provider sent, as saved. */
const SAME_ITEM = ['name', 'cat', 'poster', 'rating', 'added', 'released', 'ext', 'tmdb', 'ryear']
  .map((c) => `x.${c} IS r.${c}`)
  .join(' AND ');

/**
 * What changed against the last library `o` (D-135): `${t}_x` pairs each new item with an old one that is the same
 * (each old and each new item at most once, so repeated stream ids count), and `${t}_k` holds the compact keys of every
 * item that is not paired, old or new. Only titles with those keys can come out different.
 */
const comparing = (t: string, o: string): string[][] => [
  [`CREATE INDEX IF NOT EXISTS ${o}_is ON ${o}_i(sid)`],
  [
    `CREATE TABLE ${t}_x (rid INTEGER PRIMARY KEY, oid INTEGER NOT NULL UNIQUE)`,
    `INSERT OR IGNORE INTO ${t}_x (rid, oid) SELECT r.rowid, x.rowid FROM ${t}_r r JOIN ${o}_i x ON x.sid = r.sid WHERE ${SAME_ITEM}`,
  ],
  [
    `CREATE TABLE ${t}_k (ckey TEXT PRIMARY KEY) WITHOUT ROWID`,
    `INSERT OR IGNORE INTO ${t}_k (ckey) SELECT n.ckey FROM ${t}_r r JOIN ${NAMES} n ON n.name = r.name
      WHERE NOT EXISTS (SELECT 1 FROM ${t}_x WHERE rid = r.rowid)`,
    `INSERT OR IGNORE INTO ${t}_k (ckey) SELECT ckey FROM ${o}_i x WHERE NOT EXISTS (SELECT 1 FROM ${t}_x WHERE oid = x.rowid)`,
  ],
];

/**
 * Grouping (D-133), one step per call so no call holds the database (on desktop: the main process) for long:
 * 1. Same compact key (the key without spaces) and year. A year-less item takes its key's year when the key has
 *    exactly one.
 * 2. Each key takes the smallest TMDB id among its items; items with one group by it and the year instead (D-065).
 * The same rules as `groupTitles` (the library in memory).
 *
 * The rules are worked out in a narrow table (`_p`), and the items are written once with their title (`g`). With the
 * last library `o` (D-135), only the items whose compact key changed are grouped again: an item's group depends only on
 * the items with its key. The others keep their group and title number; a title whose group gained or lost an item
 * gets a new number above `base` (the last library's highest) and is built again, like every new title.
 */
const grouping = (t: string, o: string | null, base: number): string[][] => [
  [
    `CREATE TABLE ${t}_p (pid INTEGER PRIMARY KEY, ckey TEXT NOT NULL, year INTEGER, tmdb TEXT, gyear INTEGER, k TEXT, tm TEXT,
      gk TEXT)`,
    `INSERT INTO ${t}_p (pid, ckey, year, tmdb) SELECT r.rowid, n.ckey, IFNULL(n.nyear, r.ryear), r.tmdb
      FROM ${t}_r r JOIN ${NAMES} n ON n.name = r.name${o ? ` WHERE n.ckey IN (SELECT ckey FROM ${t}_k)` : ''}`,
  ],
  [
    `CREATE TABLE ${t}_y (ckey TEXT PRIMARY KEY, y INTEGER NOT NULL) WITHOUT ROWID`,
    `INSERT INTO ${t}_y (ckey, y) SELECT ckey, min(year) FROM ${t}_p WHERE year IS NOT NULL GROUP BY ckey
      HAVING count(DISTINCT year) = 1`,
    `UPDATE ${t}_p SET gyear = IFNULL(year, (SELECT y FROM ${t}_y WHERE ckey = ${t}_p.ckey))`,
    `UPDATE ${t}_p SET k = ckey || '|' || IFNULL(gyear, '')`,
  ],
  [
    `CREATE TABLE ${t}_t (k TEXT PRIMARY KEY, tm TEXT NOT NULL) WITHOUT ROWID`,
    `INSERT INTO ${t}_t (k, tm) SELECT k, min(tmdb) FROM ${t}_p WHERE tmdb IS NOT NULL GROUP BY k`,
    `UPDATE ${t}_p SET tm = (SELECT tm FROM ${t}_t WHERE k = ${t}_p.k)`,
    `UPDATE ${t}_p SET gk = CASE WHEN tm IS NULL THEN 'k' || k ELSE 't' || tm || '|' || IFNULL(gyear, '') END`,
  ],
  [
    `CREATE TABLE ${t}_g (g INTEGER PRIMARY KEY, gk TEXT NOT NULL UNIQUE)`,
    `INSERT INTO ${t}_g (gk) SELECT gk FROM ${t}_p GROUP BY gk ORDER BY min(pid)`,
    // Groups that lose an item to a changed key are built again too, with what they keep.
    ...(o ? [`INSERT OR IGNORE INTO ${t}_g (gk) SELECT gk FROM ${o}_i WHERE ckey IN (SELECT ckey FROM ${t}_k)`] : []),
  ],
  [
    `CREATE TABLE ${t}_i (${GROUPED_COLUMNS})`,
    // An item that is not grouped again is paired with its old self (`_x`), which says its group.
    `INSERT INTO ${t}_i (${GROUPED_NAMES})
      SELECT ${READ_ITEM}, ${
        o
          ? `IFNULL(p.gyear, x.gyear), IFNULL(p.k, x.k), IFNULL(p.tm, x.tm), IFNULL(p.gk, x.gk),
        IFNULL((SELECT g FROM ${t}_g WHERE gk = IFNULL(p.gk, x.gk)) + ${base}, x.g)`
          : `p.gyear, p.k, p.tm, p.gk, (SELECT g FROM ${t}_g WHERE gk = p.gk)`
      }
      FROM ${t}_r r JOIN ${NAMES} n ON n.name = r.name LEFT JOIN ${t}_p p ON p.pid = r.rowid${
        o ? ` LEFT JOIN ${t}_x m ON p.pid IS NULL AND m.rid = r.rowid LEFT JOIN ${o}_i x ON x.rowid = m.oid` : ''
      }
      ORDER BY r.rowid`,
    ...['_r', '_p', '_y', '_t', '_g', ...(o ? ['_x', '_k'] : [])].map((suffix) => `DROP TABLE ${t}${suffix}`),
  ],
  [`CREATE INDEX ${t}_ig ON ${t}_i(g)`, `CREATE INDEX ${t}_is ON ${t}_i(sid)`],
  ...newTitles(t, base),
];

/** What each new title (`g` above `base`) shows: its most common spelling and year, its best version's poster and quality (D-133). */
const newTitles = (t: string, base: number): string[][] => [
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
      FROM ${t}_i i WHERE g > ${base} GROUP BY g`,
    `UPDATE ${t}_a SET nkey = (SELECT nkey FROM ${t}_i x WHERE x.g = ${t}_a.g AND x.title = ${t}_a.title LIMIT 1),
      ckey = (SELECT ckey FROM ${t}_i x WHERE x.g = ${t}_a.g AND x.title = ${t}_a.title LIMIT 1),
      released = IFNULL(released, year * 10000)`,
    `CREATE UNIQUE INDEX ${t}_ag ON ${t}_a(g)`,
    `CREATE TABLE ${t}_e (g INTEGER PRIMARY KEY, id TEXT NOT NULL, lower TEXT NOT NULL)`,
  ],
];

/**
 * After the ids (`_e`): the titles newest first (the row order), the last library's unchanged titles copied as they
 * were, and the categories. The other orders are made when a list first asks for them (D-135).
 */
const finishing = (t: string, o: string | null, base: number): string[][] => {
  const built = TITLE_NAMES.split(', ')
    .map((column) => (column === 'id' || column === 'lower' ? `e.${column}` : `a.${column}`))
    .join(', ');
  return [
    [
      `CREATE TABLE ${t} (${TITLE_COLUMNS})`,
      `INSERT INTO ${t} (${TITLE_NAMES}) SELECT ${TITLE_NAMES} FROM (${
        o ? `SELECT ${TITLE_NAMES} FROM ${o} WHERE g IN (SELECT g FROM ${t}_i WHERE g <= ${base}) UNION ALL ` : ''
      }SELECT ${built} FROM ${t}_a a JOIN ${t}_e e ON e.g = a.g) ORDER BY ${NEWEST_FIRST}`,
      `DROP TABLE ${t}_a`,
      `DROP TABLE ${t}_e`,
      `CREATE UNIQUE INDEX ${t}_g ON ${t}(g)`,
      `CREATE INDEX ${t}_id ON ${t}(id)`,
    ],
    [
      `CREATE TABLE ${t}_c (cat TEXT NOT NULL, m INTEGER NOT NULL, PRIMARY KEY (cat, m)) WITHOUT ROWID`,
      `INSERT INTO ${t}_c (cat, m) SELECT DISTINCT i.cat, a.rowid FROM ${t}_i i JOIN ${t} a ON a.g = i.g WHERE i.cat IS NOT NULL`,
    ],
  ];
};

/**
 * An update in place (D-137), when few items changed: the titles of the groups that changed are worked out beside the
 * library (`_z`: their old numbers; `_i`: their items, new or kept; `_a`, `_e`: their titles), then `applying` swaps
 * them in. The rest of the library is not copied.
 */
const inPlace = (t: string, o: string, base: number): string[][] => [
  [
    `CREATE TABLE ${t}_z (g INTEGER PRIMARY KEY)`,
    `INSERT INTO ${t}_z (g) SELECT DISTINCT g FROM ${o}_i WHERE gk IN (SELECT gk FROM ${t}_g)`,
  ],
  [
    // `rid`: the item's place in the new list.
    `CREATE TABLE ${t}_i (${GROUPED_COLUMNS}, rid INTEGER NOT NULL)`,
    // The changed items, and the items whose key did not change but whose group did (it gained or lost an item): those
    // keep what they were, in their group's new number. In the order of the new list, as a whole build has them.
    `INSERT INTO ${t}_i (${GROUPED_NAMES}, rid)
      SELECT ${READ_ITEM}, p.gyear, p.k, p.tm, p.gk, (SELECT g FROM ${t}_g WHERE gk = p.gk) + ${base}, r.rowid AS rid
        FROM ${t}_p p JOIN ${t}_r r ON r.rowid = p.pid JOIN ${NAMES} n ON n.name = r.name
      UNION ALL
      SELECT ${GROUPED_NAMES.replace(/\bg$/, '')} (SELECT g FROM ${t}_g WHERE gk = x.gk) + ${base}, m.rid
        FROM ${o}_i x JOIN ${t}_x m ON m.oid = x.rowid WHERE x.g IN (SELECT g FROM ${t}_z) AND x.ckey NOT IN (SELECT ckey FROM ${t}_k)
      ORDER BY rid`,
    `CREATE INDEX ${t}_ig ON ${t}_i(g)`,
  ],
  ...newTitles(t, base),
];

/**
 * Swaps the changed titles into the library `o` in one step (D-137): their old titles, items and categories go, the new
 * ones come in (at the end: newest first becomes an order table, `_on1`), and every order is made again.
 */
const applying = (t: string, o: string, orders: { column: string; by: string }[]): string[] => {
  const built = TITLE_NAMES.split(', ')
    .map((column) => (column === 'id' || column === 'lower' ? `e.${column}` : `a.${column}`))
    .join(', ');
  return [
    `DELETE FROM ${o}_c WHERE m IN (SELECT rowid FROM ${o} WHERE g IN (SELECT g FROM ${t}_z))`,
    `DELETE FROM ${o} WHERE g IN (SELECT g FROM ${t}_z)`,
    `DELETE FROM ${o}_i WHERE g IN (SELECT g FROM ${t}_z)`,
    `INSERT INTO ${o}_i (${GROUPED_NAMES}) SELECT ${GROUPED_NAMES} FROM ${t}_i ORDER BY rowid`,
    `INSERT INTO ${o} (${TITLE_NAMES}) SELECT ${TITLE_NAMES} FROM (SELECT ${built} FROM ${t}_a a JOIN ${t}_e e ON e.g = a.g)
      ORDER BY ${NEWEST_FIRST}`,
    `INSERT INTO ${o}_c (cat, m) SELECT DISTINCT i.cat, a.rowid FROM ${t}_i i JOIN ${o} a ON a.g = i.g WHERE i.cat IS NOT NULL`,
    ...orders.flatMap(({ column, by }) => orderTable(o, column, by)),
  ];
};

/** An order's table of row numbers (D-135), made (again) from the titles as they are. */
const orderTable = (t: string, column: string, by: string): string[] => [
  `DROP TABLE IF EXISTS ${t}_o${column}`,
  `CREATE TABLE ${t}_o${column} (m INTEGER NOT NULL)`,
  `INSERT INTO ${t}_o${column} (m) SELECT rowid FROM ${t} ORDER BY ${by}`,
  `CREATE UNIQUE INDEX ${t}_o${column}m ON ${t}_o${column}(m)`,
];

/** Tables a library can have: its own, while building, and its orders (old libraries kept them as columns). */
const drops = (t: string) =>
  [
    '',
    '_d',
    '_c',
    '_s',
    '_o',
    '_r',
    '_i',
    '_y',
    '_t',
    '_g',
    '_a',
    '_p',
    '_x',
    '_k',
    '_e',
    '_z',
    ...[NEWEST, ...Object.values(ORDERS)].map(({ column }) => `_o${column}`),
  ].map((suffix) => `DROP TABLE IF EXISTS ${t}${suffix}`);

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
  /** How far the build is, from 0 to 1, over all its steps (D-135). */
  onProgress?(fraction: number): void;
  /** Milliseconds per step, for the Log (D-116). */
  onTimings?(timings: LibraryBuildTimings): void;
  /** Milliseconds of parsing between breaks for the screen. */
  sliceMs?: number;
}

export interface LibraryBuildTimings {
  /** Few items changed: the last library was updated in place (D-137). */
  inPlace: boolean;
  /** Saving the provider's items (0 when native code saved them while downloading, D-135). */
  items: number;
  /** Reading the names not seen before, and how many. */
  names: number;
  newNames: number;
  /** Comparing with the last library, and how many compact keys changed (null: nothing to compare with, D-135). */
  compare: number;
  changedKeys: number | null;
  /** The grouping queries. */
  grouping: number;
  /** The new titles' ids, and how many titles were built (the others were kept). */
  ids: number;
  builtTitles: number;
  /** The titles in their row order, indexes and categories. */
  titles: number;
}

/** Items native code already saved in a library's items table (`createItems`, D-135). */
export interface SavedItems {
  table: string;
}

/** Share of the progress bar each part of a build takes (D-135): reading new names, then the queries. */
const PROGRESS_ITEMS = 0.1;
const PROGRESS_NAMES = 0.4;

/**
 * The library in SQLite (D-121): lists, categories, languages, hidden categories and search are queries, so a start
 * reads nothing but a few rows, and a list reads only its page. Since D-133 the provider's items are saved as they come
 * and grouped into titles by queries; only names not seen before are read (parsed) here. Since D-135 an update groups
 * again only what changed, and stops early when nothing did. The same answers as the in-memory library
 * (`directApiClient`), except that titles order by their UTF-8 bytes, not UTF-16 units (they differ only between
 * characters outside the BMP and U+E000–U+FFFF).
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
      // The orders column came with D-135; libraries from before keep their orders as columns (null).
      const columns = (await db.query('PRAGMA table_info(library)')).map((row) => String(row[1]));
      if (!columns.includes('orders')) await db.run([{ sql: 'ALTER TABLE library ADD COLUMN orders TEXT' }]);
      const used = new Set((await db.query('SELECT tbl FROM library')).map((row) => String(row[0])));
      const orphans = (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'lib[0-9]*'"))
        .map((row) => String(row[0]))
        .filter((name) => !used.has(name.replace(/_[a-z0-9]+$/, '')));
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
  /** Orders being made, per library table and column (D-135). */
  const makingOrders = new Map<string, Promise<void>>();

  /** Runs each step as one call, with a break for the screen after each; `done` after each step. */
  const steps = async (list: string[][], done?: (step: number) => void) => {
    for (const [index, step] of list.entries()) {
      await db.run(step.map((sql) => ({ sql })));
      done?.(index + 1);
      await pause();
    }
  };

  const tableExists = async (name: string) =>
    (await db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", [name])).length > 0;

  const KIND_COLUMNS = 'kind, tbl, built_at, rules, count, sorts, prefixes, orders';
  const kindOf = ([, table, builtAt, rules, count, sorts, prefixes, orders]: SqlValue[]): SqlLibraryKind => ({
    table: String(table),
    builtAt: String(builtAt),
    current: Number(rules) === NORMALIZER_RULES,
    packed: Number(rules) < ITEM_RULES,
    count: Number(count),
    sorts: JSON.parse(String(sorts)) as LibrarySort[],
    prefixes: JSON.parse(String(prefixes)) as string[],
    orders: orders === null || orders === undefined ? null : (JSON.parse(String(orders)) as string[]),
  });

  /** The day each kind's names were last marked as seen (D-137). */
  const namesSeen = new Map<LibraryKind, number>();
  /** Libraries being built: tables of replaced ones are not dropped meanwhile (D-137). */
  const building = new Set<string>();
  const retiring: string[] = [];
  let sweeping = false;
  /**
   * Drops the tables of a replaced library, channel list or guide once the lists still reading them are done (D-137):
   * one table per call, and none while a library is being built, so an update does not wait for a big drop to finish.
   * A start drops what is left if the app is closed before.
   */
  const retire = (t: string) =>
    setTimeout(() => {
      retiring.push(t);
      void sweep();
    }, RETIRE_MS);
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      while (retiring.length) {
        if (building.size) {
          setTimeout(() => void sweep(), RETIRE_MS);
          return;
        }
        const t = retiring[0]!;
        try {
          const table = (
            await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND (name = ? OR name GLOB ?) LIMIT 1", [t, `${t}_*`])
          )[0]?.[0];
          if (table === undefined || table === null) retiring.shift();
          else await db.run([{ sql: `DROP TABLE IF EXISTS ${String(table)}` }]);
        } catch {
          retiring.shift(); // The database is closed or busy: the next start drops what is left.
        }
        await pause();
      }
    } finally {
      sweeping = false;
    }
  };

  /** A new library's name, with its items table (`${t}_r`) ready for the provider's items (D-135). */
  const createItems = async (): Promise<string> => {
    await prepare();
    const t = newTable();
    building.add(t);
    await db.run([{ sql: `CREATE TABLE ${t}_r (${ITEM_COLUMNS})` }]);
    return t;
  };

  /** Saves the provider's items in `${t}_r`, in batches with a break for the screen after each. */
  const saveItems = async (t: string, items: NormalizerItem[], progress: (fraction: number) => void) => {
    for (let start = 0; start < items.length; start += WRITE_BATCH) {
      const rows: SqlValue[][] = [];
      for (const item of items.slice(start, start + WRITE_BATCH)) {
        const saved = savedItem(item);
        if (!saved) continue;
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
      progress(Math.min(1, (start + WRITE_BATCH) / items.length));
      await pause();
    }
  };

  /**
   * Makes an order's table of row numbers (D-135), once; lists use it from then on. One order at a time, so each
   * writes the full list of made orders into the table of contents.
   */
  let ordersQueue: Promise<void> = Promise.resolve();
  const makeOrder = (saved: SqlLibraryKind, column: string, by: string) => {
    const t = saved.table;
    const key = `${t}|${column}`;
    let making = makingOrders.get(key);
    if (!making) {
      making = ordersQueue
        .then(async () => {
          if (saved.orders?.includes(column)) return;
          const orders = [...(saved.orders ?? []), column];
          await db.run([
            // A table left from a try that did not reach the table of contents is made again.
            ...orderTable(t, column, by).map((sql) => ({ sql })),
            { sql: 'UPDATE library SET orders = ? WHERE tbl = ?', rows: [[JSON.stringify(orders), t]] },
          ]);
          saved.orders = orders;
        })
        .catch(() => {
          // The library was replaced meanwhile, or the database is busy: a later list asks again.
          makingOrders.delete(key);
        });
      ordersQueue = making;
      makingOrders.set(key, making);
    }
    return making;
  };

  return {
    /** What the database holds for the account (no titles are read). */
    async open(account: string): Promise<Partial<Record<LibraryKind, SqlLibraryKind>>> {
      await prepare();
      const rows = await db.query(`SELECT ${KIND_COLUMNS} FROM library WHERE account = ? AND kind IN ('movie', 'series')`, [account]);
      const result: Partial<Record<LibraryKind, SqlLibraryKind>> = {};
      for (const row of rows) result[row[0] as LibraryKind] = kindOf(row);
      return result;
    },

    createItems,

    /** Drops a library that was not finished (its items failed to download). */
    async discard(t: string): Promise<void> {
      await db.run(drops(t).map((sql) => ({ sql }))).catch(() => undefined);
      building.delete(t);
    },

    retire,

    /**
     * Saves the provider's items of a kind (or takes the ones native code saved, `SavedItems`) and groups them into
     * titles (D-133), beside the current library, then switches to it in one step: a start in between still finds the
     * last complete library. Only names not seen before are read, and only titles whose items changed are built again
     * (D-135); when nothing changed, the current library stays and only its date moves; when few items changed, those
     * titles are swapped into the current library in one step instead of copying it (D-137). Also says what changed
     * against the last library (D-119).
     */
    async build(
      account: string,
      kind: LibraryKind,
      builtAt: string,
      source: NormalizerItem[] | SavedItems,
      options: LibraryBuildOptions = {},
    ): Promise<{ saved: SqlLibraryKind; changes: LibraryChanges | null }> {
      await prepare();
      const t = Array.isArray(source) ? await createItems() : source.table;
      const timings: LibraryBuildTimings = {
        inPlace: false,
        items: 0,
        names: 0,
        newNames: 0,
        compare: 0,
        changedKeys: null,
        grouping: 0,
        ids: 0,
        builtTitles: 0,
        titles: 0,
      };
      let stepStarted = Date.now();
      const took = (step: 'items' | 'names' | 'compare' | 'grouping' | 'ids' | 'titles') => {
        timings[step] = Date.now() - stepStarted;
        stepStarted = Date.now();
      };
      const progress = (from: number, to: number) => (fraction: number) => options.onProgress?.(from + (to - from) * fraction);
      const old = (await db.query(`SELECT ${KIND_COLUMNS} FROM library WHERE account = ? AND kind = ?`, [account, kind]))[0];
      const last = old ? kindOf(old) : null;
      let count: number;
      let base = 0;
      try {
        if (Array.isArray(source)) await saveItems(t, source, progress(0, PROGRESS_ITEMS));
        took('items');
        await readNewNames(t, kind, options, timings, progress(PROGRESS_ITEMS, PROGRESS_NAMES));
        took('names');
        // The last library is a starting point when its items were saved with the same title rules (D-135).
        const previous = last && last.current && !last.packed && (await tableExists(`${last.table}_i`)) ? last.table : null;
        if (previous) {
          await steps(comparing(t, previous));
          timings.changedKeys = Number((await db.query(`SELECT COUNT(*) FROM ${t}_k`))[0]?.[0] ?? 0);
          took('compare');
          if (timings.changedKeys === 0) {
            await db.run([
              ...drops(t).map((sql) => ({ sql })),
              { sql: 'UPDATE library SET built_at = ? WHERE account = ? AND kind = ?', rows: [[builtAt, account, kind]] },
            ]);
            options.onProgress?.(1);
            options.onTimings?.(timings);
            return { saved: { ...last!, builtAt }, changes: { added: 0, changed: 0, removed: 0 } };
          }
          base = Number((await db.query(`SELECT IFNULL(MAX(g), 0) FROM ${previous}_i`))[0]?.[0] ?? 0);
        }
        const groupSteps = grouping(t, previous, base);
        // Every query step moves the bar the same; the ids count as one more step.
        const queryProgress = progress(PROGRESS_NAMES, 1);
        let total = groupSteps.length + 1 + finishing(t, previous, base).length;
        // The changed keys are grouped first; then the rest of the build either beside the library or in place.
        await steps(groupSteps.slice(0, GROUPED_KEYS), (step) => queryProgress(step / total));
        if (previous && last!.orders !== null) {
          const [[regrouped], [items]] = await Promise.all([
            db.query(`SELECT COUNT(*) FROM ${t}_p`).then((rows) => rows.map(Number)),
            db.query(`SELECT COUNT(*) FROM ${t}_r`).then((rows) => rows.map(Number)),
          ]);
          timings.inPlace = (regrouped ?? 0) <= (items ?? 0) * IN_PLACE_SHARE;
        }
        const rest = timings.inPlace ? inPlace(t, previous!, base) : groupSteps.slice(GROUPED_KEYS);
        const finishSteps = timings.inPlace ? [] : finishing(t, previous, base);
        total = GROUPED_KEYS + rest.length + 1 + Math.max(1, finishSteps.length);
        await steps(rest, (step) => queryProgress((GROUPED_KEYS + step) / total));
        took('grouping');
        timings.builtTitles = await titleIds(t, account, kind, options.hashIds);
        queryProgress((GROUPED_KEYS + rest.length + 1) / total);
        took('ids');
        if (timings.inPlace) {
          const updated = await updateInPlace(t, last!, account, kind, builtAt, timings.builtTitles);
          took('titles');
          options.onProgress?.(1);
          options.onTimings?.(timings);
          return updated;
        }
        await steps(finishSteps, (step) => queryProgress((GROUPED_KEYS + rest.length + 1 + step) / total));
        count = Number((await db.query(`SELECT COUNT(*) FROM ${t}`))[0]?.[0] ?? 0);
        took('titles');
      } catch (error) {
        await db.run(drops(t).map((sql) => ({ sql }))).catch(() => undefined);
        throw error;
      } finally {
        building.delete(t);
      }
      options.onTimings?.(timings);
      const changes = last ? await changesSince(last.table, last.packed, t, count).catch(() => null) : null;
      const sorts = await sortsOf(t);
      await db.run([
        { sql: 'DELETE FROM library WHERE account = ? AND kind = ?', rows: [[account, kind]] },
        {
          sql: "INSERT INTO library (account, kind, tbl, built_at, rules, count, sorts, prefixes, orders) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]')",
          rows: [[account, kind, t, builtAt, NORMALIZER_RULES, count, JSON.stringify(sorts)]],
        },
      ]);
      // Lists still reading the old tables finish first; a start drops them if the app is closed before.
      if (last) retire(last.table);
      return { saved: { table: t, builtAt, current: true, packed: false, count, sorts, prefixes: [], orders: [] }, changes };
    },

    /** One page of a list: the same filters and orders as the in-memory library. */
    async list(saved: SqlLibraryKind, query: LibraryListQuery): Promise<LibraryPage> {
      const t = saved.table;
      const where: string[] = [];
      const params: SqlValue[] = [];
      const search = query.search?.trim().toLowerCase();
      if (query.categoryId) {
        where.push(`a.rowid IN (SELECT m FROM ${t}_c WHERE cat = ?)`);
        params.push(query.categoryId);
      }
      if (query.categoryIds) {
        if (query.categoryIds.length === 0) return { total: 0, items: [], sorts: saved.sorts };
        where.push(`a.rowid IN (SELECT m FROM ${t}_c WHERE cat IN (${placeholders(query.categoryIds.length)}))`);
        params.push(...query.categoryIds);
      }
      // Hidden categories (D-110): a title goes only when every one of its categories is hidden; search ignores them.
      const hidden = [...new Set(search ? [] : (query.hiddenCategoryIds ?? []))];
      if (hidden.length) {
        where.push(`(a.ncat = 0 OR a.ncat > ${hidden.map(() => '(instr(a.cats, ?) > 0)').join(' + ')})`);
        params.push(...hidden.map((id) => `,${id},`));
      }
      const codes = languageCodes(query.language);
      if (codes.length) {
        const hinted = [...new Set(query.languageCategoryIds ?? [])];
        where.push(`(${[...codes.map(() => 'instr(a.langs, ?) > 0'), ...hinted.map(() => 'instr(a.hints, ?) > 0')].join(' OR ')})`);
        params.push(...codes.map((code) => `,${code},`), ...hinted.map((id) => `,${id},`));
      }
      if (search) {
        where.push('(instr(a.nkey, ?) > 0 OR instr(a.lower, ?) > 0)');
        params.push(search, search);
      }
      const sort = query.sort ?? 'added';
      const order = query.order ?? (sort === 'title' ? 'asc' : 'desc');
      const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
      // Newest first is the row order. Another order: its table of row numbers when made (D-135), else sorted here
      // while it is made; libraries from before D-135 keep it as a column.
      const wanted = ORDERS[`${sort}|${order}`];
      let from = `${t} a`;
      let orderBy = 'a.rowid';
      if (wanted && saved.orders === null) orderBy = `a.${wanted.column}`;
      else if (wanted && saved.orders?.includes(wanted.column)) {
        from = `${t}_o${wanted.column} o JOIN ${t} a ON a.rowid = o.m`;
        orderBy = 'o.rowid';
      } else if (wanted) {
        orderBy = wanted.by;
        void makeOrder(saved, wanted.column, wanted.by);
      } else if (saved.orders?.includes(NEWEST.column)) {
        from = `${t}_o${NEWEST.column} o JOIN ${t} a ON a.rowid = o.m`;
        orderBy = 'o.rowid';
      }
      const offset = Math.max(0, query.offset ?? 0);
      const limit = Math.min(500, Math.max(1, query.limit ?? 100));
      const totalKey = `${t}|${filter}|${JSON.stringify(params)}`;
      const columns = saved.packed ? 'a.rowid' : 'a.id, a.title, a.year, a.poster, a.rating, a.best, a.n';
      const [rows, total] = await Promise.all([
        db.query(`SELECT ${columns} FROM ${from}${filter} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]),
        where.length === 0
          ? saved.count
          : (totals.get(totalKey) ??
            db.query(`SELECT COUNT(*) FROM ${t} a${filter}`, params).then((counted) => {
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

  /**
   * Swaps the titles worked out in `t` into the last library in one step (D-137), says what changed against it, and drops
   * what was worked out.
   */
  async function updateInPlace(
    t: string,
    last: SqlLibraryKind,
    account: string,
    kind: LibraryKind,
    builtAt: string,
    built: number,
  ): Promise<{ saved: SqlLibraryKind; changes: LibraryChanges }> {
    const o = last.table;
    const number = async (sql: string) => Number((await db.query(sql))[0]?.[0] ?? 0);
    const gone = await number(`SELECT COUNT(*) FROM ${o} WHERE g IN (SELECT g FROM ${t}_z)`);
    const known = await number(`SELECT COUNT(*) FROM ${t}_e WHERE id IN (SELECT id FROM ${o})`);
    const changed = await number(
      `SELECT COUNT(*) FROM ${t}_a a JOIN ${t}_e e ON e.g = a.g JOIN ${o} b ON b.id = e.id WHERE a.sig <> b.sig`,
    );
    // Every order made so far is made again; newest first becomes one (the new titles come at the end).
    const made = new Set(
      (await db.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB '${o}_o?*'`)).map((row) =>
        String(row[0]).slice(`${o}_o`.length),
      ),
    );
    const orders = [NEWEST, ...Object.values(ORDERS).filter(({ column }) => made.has(column))];
    const count = last.count - gone + built;
    await db.run([
      ...applying(t, o, orders).map((sql) => ({ sql })),
      {
        sql: 'UPDATE library SET built_at = ?, count = ?, orders = ? WHERE account = ? AND kind = ?',
        rows: [[builtAt, count, JSON.stringify(orders.map(({ column }) => column)), account, kind]],
      },
    ]);
    for (const key of totals.keys()) if (key.startsWith(`${o}|`)) totals.delete(key);
    const sorts = await sortsOf(o);
    await db.run([
      ...drops(t).map((sql) => ({ sql })),
      { sql: 'UPDATE library SET sorts = ? WHERE account = ? AND kind = ?', rows: [[JSON.stringify(sorts), account, kind]] },
    ]);
    return {
      saved: { ...last, builtAt, count, sorts, orders: orders.map(({ column }) => column) },
      changes: { added: built - known, changed, removed: Math.max(0, gone - known) },
    };
  }

  /** The orders a library's lists offer: by date added only when some title has one, likewise by release date. */
  async function sortsOf(t: string): Promise<LibrarySort[]> {
    const has = async (column: string) => (await db.query(`SELECT 1 FROM ${t} WHERE ${column} IS NOT NULL LIMIT 1`)).length > 0;
    const sorts: LibrarySort[] = [];
    if (await has('added')) sorts.push('added');
    sorts.push('title');
    if (await has('released')) sorts.push('released');
    return sorts;
  }

  /** Reads the names no library had before (in slices, so the screen keeps running) and keeps what they say. */
  async function readNewNames(
    t: string,
    kind: LibraryKind,
    options: LibraryBuildOptions,
    timings: LibraryBuildTimings,
    progress: (fraction: number) => void,
  ) {
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
        compactKey(title),
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
            sql: `INSERT OR REPLACE INTO ${NAMES} (name, title, nkey, ckey, nyear, quality, source, audio, atag, hdr, subs, score, qrank,
              langs, seen) VALUES (${placeholders(15)})`,
            rows,
          },
        ]);
        rows = [];
      }
      if (last || Date.now() - sliceStarted >= sliceMs) {
        progress((index + 1) / names.length);
        await pause();
        sliceStarted = Date.now();
      }
    }
    // Names seen today stay; names no update has seen for a while go. Once a day per kind is enough (D-137).
    if (namesSeen.get(kind) === today) return;
    await db.run([
      { sql: `UPDATE ${NAMES} SET seen = ? WHERE seen < ? AND name IN (SELECT name FROM ${t}_r)`, rows: [[today, today]] },
      { sql: `DELETE FROM ${NAMES} WHERE seen < ?`, rows: [[today - NAME_KEEP_DAYS]] },
    ]);
    namesSeen.set(kind, today);
  }

  /**
   * Each new title's id (the same as a title built in memory) and lower-case title, into `_e` (a narrow table: no title
   * row is written twice); how many titles were new.
   */
  async function titleIds(t: string, account: string, kind: LibraryKind, hashIds: LibraryBuildOptions['hashIds']) {
    let count = 0;
    for (let after = 0; ;) {
      const rows = await db.query(`SELECT g, ckey, year, title FROM ${t}_a WHERE g > ? ORDER BY g LIMIT ?`, [after, READ_BATCH]);
      if (rows.length === 0) return count;
      const texts = rows.map(([, ckey, year]) => masterIdText(account, kind, String(ckey), numberOrNull(year)));
      const hashed = hashIds ? await hashIds(texts) : texts.map(sha1Hex);
      await db.run([
        {
          sql: `INSERT INTO ${t}_e (g, id, lower) VALUES (?, ?, ?)`,
          rows: rows.map(([g, , , title], index) => [g ?? null, hashed[index]!.slice(0, 20), String(title).toLowerCase()]),
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
        await db.run([{ sql: `CREATE INDEX ${t}_cat ON ${t}(cat)` }, { sql: `CREATE INDEX ${t}_epg ON ${t}(lower(epg))` }]);
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
      if (old) library.retire(String(old));
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

/** An account's TV guide in the database (issue #119, D-130). */
export interface SqlGuide {
  table: string;
  builtAt: string;
  count: number;
}

/**
 * The provider's full TV guide in SQLite (issue #119, D-130): the programmes of the next day, saved as they are read
 * from the (large) XMLTV reply, in a table beside the current one that replaces it in one step, like the channel list
 * (kind "guide" in the same table of contents). Search finds programmes by title and the channels that show them.
 */
export function createSqlGuide(db: SqlDatabase, library: SqlLibrary) {
  return {
    async open(account: string): Promise<SqlGuide | null> {
      await library.open(account);
      const row = (await db.query("SELECT tbl, built_at, count FROM library WHERE account = ? AND kind = 'guide'", [account]))[0];
      return row ? { table: String(row[0]), builtAt: String(row[1]), count: Number(row[2]) } : null;
    },

    /** A new guide: `add` its programmes in batches, then `finish` switches to it (or `abort` drops it). */
    async begin(account: string) {
      await library.open(account);
      const t = newTable();
      await db.run([
        {
          sql: `CREATE TABLE ${t} (ch TEXT NOT NULL, start INTEGER NOT NULL, stop INTEGER NOT NULL, title TEXT NOT NULL, lower TEXT NOT NULL)`,
        },
      ]);
      let count = 0;
      return {
        async add(programmes: GuideProgramme[]) {
          if (!programmes.length) return;
          count += programmes.length;
          await db.run([
            {
              sql: `INSERT INTO ${t} (ch, start, stop, title, lower) VALUES (${placeholders(5)})`,
              rows: programmes.map((p): SqlValue[] => [p.channel.toLowerCase(), p.start, p.stop, p.title, p.title.toLowerCase()]),
            },
          ]);
        },
        async finish(builtAt: string): Promise<SqlGuide> {
          await db.run([{ sql: `CREATE INDEX ${t}_ch ON ${t}(ch)` }]);
          const old = (await db.query("SELECT tbl FROM library WHERE account = ? AND kind = 'guide'", [account]))[0]?.[0];
          await db.run([
            { sql: "DELETE FROM library WHERE account = ? AND kind = 'guide'", rows: [[account]] },
            {
              sql: "INSERT INTO library (account, kind, tbl, built_at, rules, count, sorts, prefixes) VALUES (?, 'guide', ?, ?, 0, ?, '[]', '[]')",
              rows: [[account, t, builtAt, count]],
            },
          ]);
          if (old) library.retire(String(old));
          return { table: t, builtAt, count };
        },
        async abort() {
          await db.run([{ sql: `DROP TABLE IF EXISTS ${t}` }]).catch(() => undefined);
        },
      };
    },

    /**
     * Programmes whose title contains `search` (any case) that have not ended at `now`, on the saved channels that
     * show them: on now first, then by start time.
     */
    async search(saved: SqlGuide, live: SqlLiveChannels, search: string, now: number, limit: number): Promise<ProgrammeMatch[]> {
      const needle = search.trim().toLowerCase();
      if (!needle) return [];
      const g = saved.table;
      const l = live.table;
      const rows = await db.query(
        `SELECT g.title, g.start, g.stop, l.id, l.name, l.cat, l.num, l.logo, l.epg, l.catchup
         FROM ${g} g JOIN ${l} l ON lower(l.epg) = g.ch
         WHERE instr(g.lower, ?) > 0 AND g.stop > ?
         ORDER BY (g.start > ?), g.start, l.rowid LIMIT ?`,
        [needle, now, now, Math.max(1, limit)],
      );
      return rows.map(([title, start, stop, id, name, categoryId, number, logoUrl, epgChannelId, catchup]) => ({
        channel: {
          id: String(id),
          name: String(name),
          categoryId: categoryId === null ? null : String(categoryId),
          number: number === null ? null : Number(number),
          logoUrl: logoUrl === null ? null : String(logoUrl),
          epgChannelId: epgChannelId === null ? null : String(epgChannelId),
          hasCatchup: Number(catchup) === 1,
        },
        programme: {
          title: String(title),
          start: new Date(Number(start)).toISOString(),
          end: new Date(Number(stop)).toISOString(),
          description: null,
        },
      }));
    },
  };
}

export type SqlGuideStore = ReturnType<typeof createSqlGuide>;
