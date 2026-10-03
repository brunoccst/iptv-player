import { describe, expect, it } from 'vitest';
import type { LibraryListQuery } from '../api/apiClient';
import { createMemoryStorage } from '../stores/storage';
import { createFakePanel } from '../testing/fakePanel';
import { createNodeSqlDatabase } from '../testing/nodeSqlDatabase';
import { createDirectApiClient } from './directApiClient';
import { buildMasters } from './normalizer/pipeline';
import { packer } from './libraryCodec';
import { createSqlLibrary } from './sqlLibrary';

const login = { serverUrl: 'panel.test:8080', username: 'demo', password: 'demo' };

/** A made-up catalog with the cases the filters care about: languages, subtitles, several categories, no dates. */
function catalog(count: number) {
  let seed = 11;
  const random = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  const prefixes = ['EN - ', 'DE - ', 'FR - ', '', '', 'IT - ', 'MULTI - '];
  const tails = [' (2019)', ' 2021', ' [4K]', ' SUB ITA', '', ' (1999) HDR', ' ENG-GER', ''];
  const words = ['Über', 'Love', 'night', 'Dark', 'city', '東京', 'war 😀', 'The Last', 'amor', 'Zeta', 'ábaco', 'Moon'];
  return Array.from({ length: count }, (_, i) => ({
    stream_id: 1000 + i,
    // Some names repeat, so titles group several versions from different categories.
    name: `${prefixes[random(prefixes.length)]}${words[(i % 37) % words.length]} ${words[((i * 7) % 29) % words.length]} ${i % 97}${tails[random(tails.length)]}`,
    category_id: String(random(9)),
    container_extension: 'mkv',
    ...(random(4) === 0 ? {} : { added: String(1_700_000_000 + random(50) * 1000) }),
    ...(random(3) === 0 ? { rating: String(random(100) / 10) } : {}),
    ...(random(5) === 0 ? {} : { stream_icon: `http://img.test/p/${i}.jpg` }),
    // Some share a TMDB id: those with the same year join (D-065, D-133).
    ...(i % 5 === 0 ? { tmdb: String(500 + (i % 85)) } : {}),
  }));
}

/** Waits for the library build that login starts; a busy machine gets time (two clients build at once). */
async function ready(api: ReturnType<typeof createDirectApiClient>) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const statuses = await api.library.status();
    if (statuses.every((status) => status.jobStatus === 'done')) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('library did not finish');
}

describe('library in SQLite (D-121)', () => {
  it('answers every list and detail the same as the library in memory', async () => {
    const panel = createFakePanel();
    panel.movies.splice(0, panel.movies.length, ...(catalog(600) as unknown as typeof panel.movies));
    const client = (withDatabase: boolean) =>
      createDirectApiClient({
        appName: 'Test',
        secureStorage: createMemoryStorage(),
        dataStorage: createMemoryStorage(),
        fetch: panel.fetch,
        now: () => new Date(panel.nowSeconds * 1000),
        libraryDb: withDatabase ? createNodeSqlDatabase() : undefined,
      });
    const memory = client(false);
    const database = client(true);
    for (const api of [memory, database]) {
      await api.auth.login(login);
      await ready(api);
    }

    const queries: LibraryListQuery[] = [];
    for (const sort of [undefined, 'added', 'title', 'released'] as const)
      for (const order of [undefined, 'asc', 'desc'] as const) queries.push({ sort, order, limit: 500 });
    for (const categoryId of ['0', '3', '8', 'missing']) queries.push({ categoryId, limit: 40, offset: 5 }, { categoryId, sort: 'title' });
    queries.push(
      { language: 'ENG' },
      { language: 'ger,ita', sort: 'title', order: 'desc' },
      { language: 'FRE', languageCategoryIds: ['1', '2'] },
      { language: 'GER', languageCategoryIds: ['4'], categoryId: '4' },
      { hiddenCategoryIds: ['1'] },
      { hiddenCategoryIds: ['1', '2', '3', '4', '5'], language: 'ENG' },
      { hiddenCategoryIds: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] },
      { categoryIds: ['2', '5'] },
      { categoryIds: [] },
      { categoryIds: ['7'], hiddenCategoryIds: ['7'] },
      { search: 'love' },
      { search: 'ÜBER' },
      { search: '😀', sort: 'title' },
      { search: 'love', hiddenCategoryIds: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] },
      { search: 'no such title' },
      { limit: 7, offset: 590 },
    );
    for (const query of queries) {
      const expected = await memory.library.list('movies', query);
      expect({ query, page: await database.library.list('movies', query) }).toEqual({ query, page: expected });
    }
    const everything = await memory.library.list('movies', { limit: 500 });
    expect(everything.total).toBeGreaterThan(100);
    for (const card of everything.items.slice(0, 60))
      expect(await database.library.get('movies', card.id)).toEqual(await memory.library.get('movies', card.id));
    expect(await database.library.status()).toEqual(await memory.library.status());
  }, 30_000);

  it('a start drops the tables of a build that never finished; the saved library stays', async () => {
    const db = createNodeSqlDatabase();
    await createSqlLibrary(db, async () => undefined).build('acc', 'movie', '2026-01-01T00:00:00Z', [
      { id: 1, name: 'EN - Big Movie (2020)' },
    ]);
    // The app closed while saving the next build.
    await db.run([{ sql: 'CREATE TABLE lib1 (id TEXT)' }, { sql: 'CREATE TABLE lib1_r (m INTEGER)' }]);
    const tables = async () => (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map((row) => row[0]);
    expect(await tables()).toContain('lib1_r');

    const library = createSqlLibrary(db, async () => undefined);
    const saved = (await library.open('acc')).movie!;
    expect(await tables()).not.toContain('lib1');
    expect(await tables()).not.toContain('lib1_r');
    expect(await library.list(saved, {})).toMatchObject({ total: 1, items: [{ title: 'Big Movie', year: 2020 }] });
    expect(await library.open('other')).toEqual({});
  });

  it('groups by key, year and TMDB id, reads only new names, and says what changed (D-133)', async () => {
    const db = createNodeSqlDatabase();
    const library = createSqlLibrary(db, async () => undefined);
    const items = [
      { id: 1, name: 'EN - Money Heist (2017)', tmdbId: '71446', addedAt: 100 },
      { id: 2, name: 'ES - La Casa de Papel (2017) 4K', addedAt: 300 },
      { id: 3, name: 'La Casa de Papel (2017)', tmdbId: '71446', addedAt: 200 },
      { id: 4, name: 'The Shawshank Redemption (1994)', addedAt: 50 },
      { id: 5, name: 'The Shawshank Redemtion (1994) 720p' },
      { id: 6, name: 'Inception HD', categoryId: '7' },
      { id: 7, name: 'Inception (2010) 4K', categoryId: '8' },
    ];
    let newNames = -1;
    const first = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', items, { onTimings: (time) => (newNames = time.newNames) });
    expect(newNames).toBe(7);
    expect(first.changes).toBeNull();
    const page = await library.list(first.saved, { sort: 'title' });
    expect(page.items.map(({ title, year, variantCount }) => [title, year, variantCount])).toEqual([
      ['Inception', 2010, 2],
      ['La Casa de Papel', 2017, 3],
      ['The Shawshank Redemption', 1994, 1],
      ['The Shawshank Redemtion', 1994, 1],
    ]);
    // "La Casa de Papel" items take the TMDB id one of them has; "Money Heist" has the same id and year: one title.
    // Similar spellings stay apart.
    const expected = buildMasters('acc', 'movie', items);
    expect(expected.map((master) => master.title).sort()).toEqual(page.items.map((card) => card.title));
    for (const master of expected) expect(await library.get(first.saved, master.id)).toEqual(master);

    // The next day: one name more, one gone, one changed rating; only the new name is read.
    const next = [...items.slice(1), { id: 8, name: 'Dune (2021)' }].map((item) => (item.id === 7 ? { ...item, rating: 8 } : item));
    const second = await library.build('acc', 'movie', '2026-01-02T00:00:00Z', next, { onTimings: (time) => (newNames = time.newNames) });
    expect(newNames).toBe(1);
    expect(second.changes).toEqual({ added: 1, changed: 2, removed: 0 });
    expect((await library.open('acc')).movie).toMatchObject({ table: second.saved.table, count: 5, current: true, packed: false });
  });

  it('a library saved before D-133 still lists and opens until the new one is built', async () => {
    const db = createNodeSqlDatabase();
    const library = createSqlLibrary(db, async () => undefined);
    await library.open('acc');
    const [master] = buildMasters('acc', 'movie', [{ id: 1, name: 'EN - Big Movie (2020) 4K', categoryId: '3' }]);
    const { packMaster, prefixes } = packer();
    await db.run([
      {
        sql: `CREATE TABLE lib5 (id TEXT NOT NULL, lower TEXT NOT NULL, nkey TEXT NOT NULL, ncat INTEGER NOT NULL, cats TEXT NOT NULL,
          langs TEXT NOT NULL, hints TEXT NOT NULL, a0 INTEGER, r1 INTEGER, r0 INTEGER, t0 INTEGER, t1 INTEGER)`,
      },
      { sql: 'CREATE TABLE lib5_d (m INTEGER PRIMARY KEY, data TEXT NOT NULL)' },
      { sql: 'CREATE TABLE lib5_c (cat TEXT NOT NULL, m INTEGER NOT NULL, PRIMARY KEY (cat, m)) WITHOUT ROWID' },
      { sql: "INSERT INTO lib5 VALUES (?, 'big movie', 'big movie', 1, ',3,', ',ENG,', '', 1, 1, 1, 1, 1)", rows: [[master!.id]] },
      { sql: 'INSERT INTO lib5_d VALUES (1, ?)', rows: [[JSON.stringify(packMaster(master!))]] },
      { sql: "INSERT INTO lib5_c VALUES ('3', 1)" },
      {
        sql: "INSERT INTO library VALUES ('acc', 'movie', 'lib5', '2025-01-01T00:00:00Z', 5, 1, '[\"title\"]', ?)",
        rows: [[JSON.stringify(prefixes)]],
      },
    ]);
    const saved = (await createSqlLibrary(db, async () => undefined).open('acc')).movie!;
    expect(saved).toMatchObject({ current: false, packed: true });
    expect(await library.list(saved, { categoryId: '3', language: 'ENG' })).toMatchObject({ total: 1, items: [{ title: 'Big Movie' }] });
    expect(await library.get(saved, master!.id)).toEqual(master);
    const built = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', [
      { id: 1, name: 'EN - Big Movie (2020) 4K', categoryId: '3' },
    ]);
    expect(built.changes).toEqual({ added: 0, changed: 0, removed: 0 });
  });

  it('live channels: every list, guide page and search answers the same as without a database (D-123)', async () => {
    const panel = createFakePanel();
    const names = ['News', 'Sport', 'Música', 'Kids', 'Cinema 😀', 'Docs', 'EN | BBC', 'DE | ARD'];
    panel.channels.splice(
      0,
      panel.channels.length,
      ...Array.from({ length: 700 }, (_, i) => ({
        stream_id: 5000 + i,
        name: `${names[i % names.length]} ${i}`,
        num: i + 1,
        ...(i % 11 === 0 ? {} : { category_id: String(i % 7) }),
        ...(i % 3 === 0 ? { epg_channel_id: `ch${i}` } : {}),
      })),
    );
    // What the database client asks the provider for, apart from the other client.
    const asked: string[] = [];
    const client = (withDatabase: boolean) =>
      createDirectApiClient({
        appName: 'Test',
        secureStorage: createMemoryStorage(),
        dataStorage: createMemoryStorage(),
        fetch: withDatabase
          ? (input, init) => {
              asked.push(String(input));
              return panel.fetch(input, init);
            }
          : panel.fetch,
        now: () => new Date(panel.nowSeconds * 1000),
        libraryDb: withDatabase ? createNodeSqlDatabase() : undefined,
      });
    const memory = client(false);
    const database = client(true);
    for (const api of [memory, database]) await api.auth.login(login);
    const channelLists = () => asked.filter((url) => url.includes('action=get_live_streams')).length;

    const all = await database.catalog.liveChannels(null);
    expect(all).toHaveLength(700);
    expect(all).toEqual(await memory.catalog.liveChannels(null));
    for (const categoryId of ['0', '3', '6', 'missing'])
      expect(await database.catalog.liveChannels(categoryId)).toEqual(await memory.catalog.liveChannels(categoryId));
    for (const search of ['sport', 'MÚSICA', '😀', 'bbc 7', 'nothing like this'])
      for (const limit of [undefined, 30])
        expect(await database.catalog.liveChannels(null, undefined, { search, limit })).toEqual(
          await memory.catalog.liveChannels(null, undefined, { search, limit }),
        );
    const pages = [
      {},
      { offset: 50, limit: 50 },
      { categoryId: '2', limit: 20 },
      { categoryIds: ['1', '4'], offset: 10, limit: 30 },
      { categoryIds: [] },
      { hiddenCategoryIds: ['0', '1', '2'], limit: 200 },
      { categoryId: '5', hiddenCategoryIds: ['5'] },
    ];
    for (const query of pages)
      expect({ query, grid: await database.epg.grid(query) }).toEqual({ query, grid: await memory.epg.grid(query) });
    // Every list, search and guide page came from the database: the list was downloaded once.
    expect(channelLists()).toBe(1);
  });
});
