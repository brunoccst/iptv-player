import { describe, expect, it, vi } from 'vitest';
import type { LibraryListQuery } from '../api/apiClient';
import { createMemoryStorage } from '../stores/storage';
import { createFakePanel } from '../testing/fakePanel';
import { createNodeSqlDatabase } from '../testing/nodeSqlDatabase';
import { createDirectApiClient } from './directApiClient';
import { compactKey, parseTitle } from './normalizer/parser';
import { buildMasters, masterId, type NormalizerItem } from './normalizer/pipeline';
import { packer } from './libraryCodec';
import { nameRow, type NameRow } from './nameRow';
import { createSqlLibrary, listFingerprint, type LibraryBuildTimings, type SqlLibraryKind } from './sqlLibrary';

const login = { serverUrl: 'panel.test:8080', username: 'demo', password: 'demo' };

/** A made-up catalog with the cases the filters care about: languages, subtitles, several categories, no dates. */
function catalog(count: number) {
  let seed = 11;
  const random = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  const prefixes = ['EN - ', 'DE - ', 'FR - ', '', '', 'IT - ', 'MULTI - '];
  const tails = [' (2019)', ' 2021', ' [4K]', ' SUB ITA', '', ' (1999) HDR', ' ENG-GER', '', ' HDTS', ' CAM (2019)', ' TC'];
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
    // Some share a TMDB id: those with the same year join (D-133).
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
    for (const sort of [undefined, 'added', 'title', 'released', 'rating'] as const)
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
    // Some titles have only cinema copies (D-141).
    expect(new Set(everything.items.map((card) => card.lowSource))).toEqual(new Set([null, 'CAM', 'TS', 'TC']));
    // Only the database's titles can be split and merged (issue #243).
    for (const card of everything.items.slice(0, 60))
      expect(await database.library.get('movies', card.id)).toEqual({
        ...(await memory.library.get('movies', card.id)),
        regrouping: { merged: false, splitOff: false },
      });
    expect(await database.library.status()).toEqual(await memory.library.status());
  }, 30_000);

  it("cover tags go by the list's languages, in memory and in the database (D-235)", async () => {
    const panel = createFakePanel();
    const movie = (id: number, name: string, category = '1') => ({
      stream_id: id,
      name,
      category_id: category,
      container_extension: 'mkv',
    });
    panel.movies.splice(
      0,
      panel.movies.length,
      ...([
        movie(1, 'EN - Heat (1995) HDTS'),
        movie(2, 'PT - Heat (1995) TS'),
        movie(3, 'FR - Heat (1995) 1080p'),
        movie(4, 'Heat (1995) 4K', '9'),
      ] as unknown as typeof panel.movies),
    );
    for (const libraryDb of [undefined, createNodeSqlDatabase()]) {
      const api = createDirectApiClient({
        appName: 'Test',
        secureStorage: createMemoryStorage(),
        dataStorage: createMemoryStorage(),
        fetch: panel.fetch,
        now: () => new Date(panel.nowSeconds * 1000),
        libraryDb,
      });
      await api.auth.login(login);
      await ready(api);
      const tags = async (query: LibraryListQuery) =>
        (await api.library.list('movies', query)).items.map(({ bestQuality, lowSource }) => ({ bestQuality, lowSource }));
      expect(await tags({})).toEqual([{ bestQuality: '4K', lowSource: null }]);
      expect(await tags({ language: 'ENG,POR' })).toEqual([{ bestQuality: null, lowSource: 'TS' }]);
      expect(await tags({ language: 'FRE' })).toEqual([{ bestQuality: '1080p', lowSource: null }]);
      // A version without a language counts in a category of the chosen ones.
      expect(await tags({ language: 'ENG', languageCategoryIds: ['9'] })).toEqual([{ bestQuality: '4K', lowSource: null }]);
    }
  });

  it("another device's splits and merges apply once a sync or backup brings them (issue #267)", async () => {
    const panel = createFakePanel();
    let later = 0;
    const device = () => {
      const dataStorage = createMemoryStorage();
      const api = createDirectApiClient({
        appName: 'Test',
        secureStorage: createMemoryStorage(),
        dataStorage,
        fetch: panel.fetch,
        now: () => new Date(panel.nowSeconds * 1000 + later),
        libraryDb: createNodeSqlDatabase(),
      });
      return { api, dataStorage };
    };
    const phone = device();
    const tv = device();
    for (const { api } of [phone, tv]) {
      await api.auth.login(login);
      await ready(api);
    }
    const titles = async (api: ReturnType<typeof createDirectApiClient>) =>
      (await api.library.list('movies', { sort: 'title' })).items.map(({ title, variantCount }) => `${title} ${variantCount}`).sort();
    const idOf = async (title: string) => (await phone.api.library.list('movies', { search: title })).items[0]!.id;
    expect(await titles(tv.api)).toEqual(['Another Film 1', 'Big Test Movie 2']);
    const accountId = (await phone.api.auth.me()).id;
    const key = `direct.titleRules.${accountId}`;
    const carry = async () => {
      await tv.dataStorage.setItem(key, (await phone.dataStorage.getItem(key))!);
      // The TV looks for a new record every 10 s.
      later += 11_000;
    };

    const big = await idOf('Big Test Movie');
    await phone.api.library.regroup!('movies', big, { action: 'split', streamId: '102' });
    const merged = await phone.api.library.regroup!('movies', big, { action: 'merge', fromId: await idOf('Another Film') });
    expect(await titles(phone.api)).toEqual(['Big Test Movie 1', 'Big Test Movie 2']);
    await carry();
    expect(await titles(tv.api)).toEqual(['Big Test Movie 1', 'Big Test Movie 2']);

    // Undoing on the phone undoes on the TV too.
    await phone.api.library.regroup!('movies', merged, { action: 'undo' });
    await carry();
    expect(await titles(tv.api)).toEqual(['Another Film 1', 'Big Test Movie 1', 'Big Test Movie 1']);
  });

  it('the app splits and merges titles by hand, and says how a title came out (issue #243)', async () => {
    const panel = createFakePanel();
    const api = createDirectApiClient({
      appName: 'Test',
      secureStorage: createMemoryStorage(),
      dataStorage: createMemoryStorage(),
      fetch: panel.fetch,
      now: () => new Date(panel.nowSeconds * 1000),
      libraryDb: createNodeSqlDatabase(),
    });
    await api.auth.login(login);
    await ready(api);
    const titles = async () =>
      (await api.library.list('movies', { sort: 'title' })).items.map(({ title, variantCount }) => `${title} ${variantCount}`).sort();
    const idOf = async (title: string) => (await api.library.list('movies', { search: title })).items[0]!.id;
    expect(await titles()).toEqual(['Another Film 1', 'Big Test Movie 2']);
    const big = await idOf('Big Test Movie');
    expect((await api.library.get('movies', big)).regrouping).toEqual({ merged: false, splitOff: false });

    // The rest of the title is what the details show next.
    expect(await api.library.regroup!('movies', big, { action: 'split', streamId: '102' })).toBe(big);
    expect(await titles()).toEqual(['Another Film 1', 'Big Test Movie 1', 'Big Test Movie 1']);
    const split = (await api.library.list('movies', { search: 'big' })).items.find((card) => card.id !== big)!.id;
    expect((await api.library.get('movies', split)).regrouping).toEqual({ merged: false, splitOff: true });

    const merged = await api.library.regroup!('movies', big, { action: 'merge', fromId: await idOf('Another Film') });
    expect(await titles()).toEqual(['Big Test Movie 1', 'Big Test Movie 2']);
    expect((await api.library.get('movies', merged)).regrouping).toEqual({ merged: true, splitOff: false });

    await api.library.regroup!('movies', merged, { action: 'undo' });
    await api.library.regroup!('movies', split, { action: 'undo' });
    expect(await titles()).toEqual(['Another Film 1', 'Big Test Movie 2']);
    // Without a database, titles cannot be split or merged.
    const memory = createDirectApiClient({
      appName: 'Test',
      secureStorage: createMemoryStorage(),
      dataStorage: createMemoryStorage(),
      fetch: panel.fetch,
      now: () => new Date(panel.nowSeconds * 1000),
    });
    await memory.auth.login(login);
    await ready(memory);
    expect((await memory.library.get('movies', big)).regrouping).toBeUndefined();
  });

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

  it('two works of one name and year with different TMDB ids stay two titles, like the library in memory (issue #187, D-133)', async () => {
    const db = createNodeSqlDatabase();
    const library = createSqlLibrary(db, async () => undefined);
    const items = [
      { id: 1, name: 'The Odyssey (2026)', tmdbId: '1033127', addedAt: 100 },
      { id: 2, name: 'EN - The Odyssey (2026) 4K', tmdbId: '1033127', addedAt: 110 },
      { id: 3, name: 'The Odyssey (2026)', tmdbId: '1499711', addedAt: 120 },
      // No id: the key has two, so it is a title of its own.
      { id: 4, name: 'The Odyssey (2026) HD', addedAt: 130 },
      // No id: the key has only one, so it joins it.
      { id: 5, name: 'Heat (1995)', tmdbId: '949' },
      { id: 6, name: 'Heat (1995) 4K' },
    ];
    const { saved } = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', items);
    const page = await library.list(saved, { sort: 'title' });
    expect(page.items.map(({ title, variantCount }) => `${title} ${variantCount}`).sort()).toEqual([
      'Heat 2',
      'The Odyssey 1',
      'The Odyssey 1',
      'The Odyssey 2',
    ]);
    // Each title has its own id; the first TMDB id keeps the id the whole key had before.
    const expected = buildMasters('acc', 'movie', items);
    expect(new Set(expected.map((master) => master.id)).size).toBe(4);
    expect(expected.find((master) => master.variants.some((variant) => variant.streamId === '1'))!.id).toBe(
      masterId('acc', 'movie', compactKey(parseTitle('The Odyssey (2026)')), 2026),
    );
    for (const master of expected) expect(await library.get(saved, master.id)).toEqual(master);
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

  it('names read elsewhere (TV WebView, issue #228) give the same library; a failure reads them here', async () => {
    const items = Array.from({ length: 2500 }, (_, i) => ({
      id: i + 1,
      name: `EN - Title ${i} (${2000 + (i % 20)})${i % 3 ? ' 4K' : ''}`,
    }));
    const listOf = async (parseNames?: (names: string[]) => Promise<NameRow[]>) => {
      const library = createSqlLibrary(createNodeSqlDatabase(), async () => undefined);
      const { saved } = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', items, { parseNames });
      return (await library.list(saved, { sort: 'title', limit: 500 })).items;
    };
    const expected = await listOf();
    const batches: number[] = [];
    expect(await listOf(async (names) => (batches.push(names.length), names.map(nameRow)))).toEqual(expected);
    expect(batches).toEqual([2000, 500]);
    // Fails after the first batch, or answers too few: the rest is read here.
    let calls = 0;
    expect(await listOf(async (names) => (calls++ ? Promise.reject(new Error('renderer gone')) : names.map(nameRow)))).toEqual(expected);
    expect(calls).toBe(2);
    expect(await listOf(async (names) => names.slice(1).map(nameRow))).toEqual(expected);
  });

  it('a change of grouping rules alone regroups without reading the names again (D-017)', async () => {
    const db = createNodeSqlDatabase();
    const items = [
      { id: 1, name: 'EN - Money Heist (2017)', tmdbId: '71446' },
      { id: 2, name: 'La Casa de Papel (2017)', tmdbId: '71446' },
      { id: 3, name: 'Dune (2021) 4K' },
    ];
    await createSqlLibrary(db, async () => undefined).build('acc', 'movie', '2026-01-01T00:00:00Z', items);
    // As the app left it before the update: built with rules 8, its names read with 8, which kept "La" in keys.
    await db.run([
      { sql: 'ALTER TABLE title_names_9 RENAME TO title_names_8' },
      { sql: "UPDATE title_names_8 SET nkey = 'la casa de papel' WHERE nkey = 'casa de papel'" },
      { sql: 'UPDATE library SET rules = 8' },
    ]);

    const library = createSqlLibrary(db, async () => undefined);
    expect((await library.open('acc')).movie).toMatchObject({ current: false });
    let newNames = -1;
    const built = await library.build('acc', 'movie', '2026-01-02T00:00:00Z', items, { onTimings: (time) => (newNames = time.newNames) });
    // Only the name whose key started with an article added in 9 is read again (issue #217).
    expect(newNames).toBe(1);
    expect((await library.open('acc')).movie).toMatchObject({ table: built.saved.table, count: 2, current: true });
    const tables = await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'title_names_*'");
    expect(tables).toEqual([['title_names_9']]);
  });

  it('numbers group without their leading zeros, with the same id as in memory (D-133)', async () => {
    const library = createSqlLibrary(createNodeSqlDatabase(), async () => undefined);
    const items = [
      { id: 1, name: 'Show Part 02 (2020)' },
      { id: 2, name: 'EN - Show Part 2 (2020) 1080p' },
      { id: 3, name: 'Show Part 3 (2020)' },
    ];
    const { saved } = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', items);
    const page = await library.list(saved, { sort: 'title' });
    expect(page.items.map(({ id, variantCount }) => [id, variantCount])).toEqual(
      buildMasters('acc', 'movie', items).map((master) => [master.id, master.variants.length]),
    );
    expect(page.items.map((card) => card.variantCount)).toEqual([2, 1]);
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
        sql: "INSERT INTO library (account, kind, tbl, built_at, rules, count, sorts, prefixes) VALUES ('acc', 'movie', 'lib5', '2025-01-01T00:00:00Z', 5, 1, '[\"title\"]', ?)",
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

  it('live channels: every list, guide page and search answers the same as without a database (D-121)', async () => {
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

  describe('updates only what changed (D-135)', () => {
    type Item = NormalizerItem & { id: number };
    const items = (count: number): Item[] =>
      catalog(count).map((entry, index) => ({
        id: entry.stream_id,
        name: entry.name,
        categoryId: entry.category_id,
        posterUrl: entry.stream_icon ?? null,
        rating: entry.rating === undefined ? null : Number(entry.rating),
        addedAt: entry.added === undefined ? null : Number(entry.added),
        containerExtension: 'mkv',
        tmdbId: entry.tmdb ?? null,
        releaseDate: index % 13 === 0 ? `20${10 + (index % 9)}-0${1 + (index % 8)}-1${index % 9}` : null,
      }));

    /** Library tables other than those of `table` (what builds worked out, dropped in the background). */
    const leftovers = async (db: ReturnType<typeof createNodeSqlDatabase>, table: string) =>
      (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'lib[0-9]*'"))
        .map((row) => String(row[0]))
        .filter((name) => !name.startsWith(table));

    /**
     * Every title newest first (without the internal group number; an update in place adds titles at the end, D-135), its
     * versions, and the category pages.
     */
    async function contents(
      db: ReturnType<typeof createNodeSqlDatabase>,
      library: ReturnType<typeof createSqlLibrary>,
      saved: SqlLibraryKind,
    ) {
      const t = saved.table;
      const titles = await db.query(
        `SELECT id, lower, title, nkey, ckey, year, poster, rating, best, n, added, released, ncat, cats, langs, hints, sig FROM ${t} ORDER BY added IS NULL, added DESC, title, IFNULL(year, -1), id`,
      );
      const categories = await db.query(`SELECT c.cat, a.id FROM ${t}_c c JOIN ${t} a ON a.rowid = c.m ORDER BY c.cat, a.id`);
      const details = [];
      for (const [id] of titles) details.push(await library.get(saved, String(id)));
      const lists = [];
      for (const [sort, order] of [
        ['added', 'desc'],
        ['added', 'asc'],
        ['title', 'asc'],
        ['title', 'desc'],
        ['released', 'desc'],
        ['released', 'asc'],
        ['rating', 'desc'],
        ['rating', 'asc'],
      ] as const)
        for (const query of [
          { sort, order, limit: 500 },
          { sort, order, categoryId: '3', offset: 2, limit: 20 },
          { sort, order, search: 'love' },
        ])
          lists.push(await library.list(saved, query));
      return { count: saved.count, sorts: saved.sorts, titles, categories, details, lists };
    }

    it('builds the same library as a whole new build, whatever changed', async () => {
      const before = items(900);
      const after: Item[] = before
        .filter((_, index) => index % 37 !== 5)
        .map((item, index) => {
          if (index % 41 === 3) return { ...item, name: `${String(item.name)} Reloaded` };
          if (index % 43 === 4) return { ...item, rating: 9.5, posterUrl: `http://img.test/new/${item.id}.jpg` };
          if (index % 47 === 6) return { ...item, tmdbId: '777' };
          if (index % 53 === 7) return { ...item, addedAt: 1_800_000_000 };
          if (index % 59 === 8) return { ...item, categoryId: '42' };
          return item;
        });
      after.push(
        // The same TMDB id and year as an unchanged item: joins its title.
        {
          id: 9001,
          name: 'Totally Different Name (2019)',
          tmdbId: before.find((item) => item.tmdbId && /2019/.test(String(item.name)))!.tmdbId!,
        },
        // A year-less version of a title with one year; a key that had no year gets one.
        { id: 9002, name: String(before[10]!.name).replace(/ \(\d{4}\).*| \d{4}$/, '') },
        { id: 9003, name: 'Brand New (2024) 4K', categoryId: '3', addedAt: 1_900_000_000 },
        // A stream id twice.
        { ...before[20]! },
      );
      const make = () => {
        const db = createNodeSqlDatabase();
        return { db, library: createSqlLibrary(db, async () => undefined) };
      };
      const updated = make();
      const first = await updated.library.build('acc', 'movie', '2026-01-01T00:00:00Z', before);
      // An order made before the update is made again with it (D-135).
      await updated.library.list(first.saved, { sort: 'title', order: 'asc' });
      await vi.waitFor(() => expect(first.saved.orders).toEqual(['t0']));
      let changedKeys: number | null = null;
      let inPlace = false;
      const second = await updated.library.build('acc', 'movie', '2026-01-02T00:00:00Z', after, {
        onTimings: (time) => ({ changedKeys, inPlace } = time),
      });
      expect(changedKeys).toBeGreaterThan(0);
      expect(inPlace).toBe(true);
      expect(second.saved.table).toBe(first.saved.table);
      expect(second.saved.orders).toEqual(['n1', 't0']);
      expect(second.saved.fingerprint).toBe(listFingerprint(after));
      expect(second.changes!.added + second.changes!.changed + second.changes!.removed).toBeGreaterThan(0);
      const fresh = make();
      const whole = await fresh.library.build('acc', 'movie', '2026-01-02T00:00:00Z', after);
      expect(await contents(updated.db, updated.library, second.saved)).toEqual(await contents(fresh.db, fresh.library, whole.saved));

      // And back: the titles that were removed come back, the duplicate goes.
      const third = await updated.library.build('acc', 'movie', '2026-01-03T00:00:00Z', before);
      const again = make();
      const original = await again.library.build('acc', 'movie', '2026-01-03T00:00:00Z', before);
      expect(await contents(updated.db, updated.library, third.saved)).toEqual(await contents(again.db, again.library, original.saved));
      // Nothing is left of what the updates worked out, once it is dropped in the background (D-135).
      await vi.waitFor(async () => expect(await leftovers(updated.db, first.saved.table)).toEqual([]));
    }, 60_000);

    it('splits and merges titles by hand, the same as a whole build with those rules (issue #243)', async () => {
      const list: Item[] = [
        ...items(400),
        { id: 1, name: 'The Shawshank Redemption (1994)', addedAt: 50 },
        { id: 2, name: 'The Shawshank Redemtion (1994) 720p' },
        { id: 3, name: 'The Shawshank Redemption (1994) 4K' },
      ];
      const make = () => {
        const db = createNodeSqlDatabase();
        return { db, library: createSqlLibrary(db, async () => undefined) };
      };
      const { db, library } = make();
      let saved = (await library.build('acc', 'movie', '2026-01-01T00:00:00Z', list)).saved;
      const shawshank = async () =>
        (await library.list(saved, { search: 'shawshank', sort: 'title' })).items.map(({ title, variantCount }) => [title, variantCount]);
      const idOf = async (title: string) =>
        (await library.list(saved, { search: 'shawshank' })).items.find((card) => card.title === title)!.id;
      /** The rules changed: grouped again, and the same as a whole build with those rules. */
      const regroup = async (keys: string[]) => {
        expect(keys.length).toBeGreaterThan(0);
        let changedKeys: number | null = null;
        const result = (await library.regroup('acc', 'movie', '2026-01-02T00:00:00Z', keys, {
          onTimings: (time) => (changedKeys = time.changedKeys),
        }))!;
        expect(changedKeys).toBe(keys.length);
        saved = result.saved;
        const fresh = make();
        await fresh.library.open('acc');
        const rules = await db.query('SELECT account, kind, rule, src, dst FROM title_rules');
        if (rules.length) await fresh.db.run([{ sql: 'INSERT INTO title_rules VALUES (?, ?, ?, ?, ?)', rows: rules }]);
        const whole = await fresh.library.build('acc', 'movie', '2026-01-02T00:00:00Z', list);
        expect(await contents(db, library, saved)).toEqual(await contents(fresh.db, fresh.library, whole.saved));
      };
      expect(await shawshank()).toEqual([
        ['The Shawshank Redemption', 2],
        ['The Shawshank Redemtion', 1],
      ]);

      const into = await idOf('The Shawshank Redemption');
      await regroup(
        await library.changeRules('acc', 'movie', saved, { action: 'merge', id: into, fromId: await idOf('The Shawshank Redemtion') }),
      );
      expect(await shawshank()).toEqual([['The Shawshank Redemption', 3]]);
      const merged = await idOf('The Shawshank Redemption');
      expect(await library.regroupedOf('acc', 'movie', saved, merged)).toEqual({ merged: true, splitOff: false });

      await regroup(await library.changeRules('acc', 'movie', saved, { action: 'split', id: merged, streamId: '3' }));
      // What is left takes its most common spelling; a tie goes to the best version (D-133).
      expect(await shawshank()).toEqual([
        ['The Shawshank Redemption', 1],
        ['The Shawshank Redemtion', 2],
      ]);
      const ids = (await library.list(saved, { search: 'shawshank' })).items.map((card) => card.id);
      const splitOff = (await library.holdersOf(saved, ['3'])).get('3')!;
      expect(ids).toContain(splitOff);
      expect(new Set(ids).size).toBe(2);
      expect(await library.regroupedOf('acc', 'movie', saved, splitOff)).toEqual({ merged: false, splitOff: true });

      // The same list again changes nothing: the rules stay applied.
      let sameList = false;
      saved = (await library.build('acc', 'movie', '2026-01-03T00:00:00Z', list, { onTimings: (time) => (sameList = time.sameList) }))
        .saved;
      expect(sameList).toBe(true);
      expect(await shawshank()).toHaveLength(2);

      // Undo, one title after the other: as built at first.
      await regroup(await library.changeRules('acc', 'movie', saved, { action: 'undo', id: splitOff }));
      expect(await shawshank()).toEqual([['The Shawshank Redemption', 3]]);
      await regroup(await library.changeRules('acc', 'movie', saved, { action: 'undo', id: await idOf('The Shawshank Redemption') }));
      expect(await shawshank()).toEqual([
        ['The Shawshank Redemption', 2],
        ['The Shawshank Redemtion', 1],
      ]);
      expect(await db.query('SELECT * FROM title_rules')).toEqual([]);
      // A single version cannot be split off, and a title cannot be merged into itself.
      const single = await idOf('The Shawshank Redemtion');
      expect(await library.changeRules('acc', 'movie', saved, { action: 'split', id: single, streamId: '2' })).toEqual([]);
      expect(await library.changeRules('acc', 'movie', saved, { action: 'merge', id: single, fromId: single })).toEqual([]);
    }, 60_000);

    it("keeps a merge when the provider changes a merged title's key, on either side (issue #311)", async () => {
      const db = createNodeSqlDatabase();
      const library = createSqlLibrary(db, async () => undefined);
      const before: Item[] = [
        ...items(400),
        { id: 1, name: 'The Shawshank Redemption (1994)', addedAt: 50 },
        { id: 2, name: 'Shawshank Redemtion (1994) 720p' },
        { id: 3, name: 'Um Sonho de Liberdade (1994)' },
      ];
      let saved = (await library.build('acc', 'movie', '2026-01-01T00:00:00Z', before)).saved;
      const found = async () => [
        ...(await library.list(saved, { search: 'shawshank', sort: 'title' })).items,
        ...(await library.list(saved, { search: 'sonho', sort: 'title' })).items,
      ];
      /** How many versions each title of these three movies has. */
      const titles = async () => [...new Map((await found()).map(({ id, variantCount }) => [id, variantCount])).values()];
      const holder = async (streamId: string) => (await library.holdersOf(saved, [streamId])).get(streamId)!;
      const merge = async (into: string, from: string) => {
        const keys = await library.changeRules('acc', 'movie', saved, {
          action: 'merge',
          id: await holder(into),
          fromId: await holder(from),
        });
        saved = (await library.regroup('acc', 'movie', '2026-01-02T00:00:00Z', keys))!.saved;
      };
      expect(await titles()).toEqual([1, 1, 1]);
      await merge('1', '2');
      await merge('1', '3');
      expect(await titles()).toEqual([3]);
      const update = async (list: Item[], at: string) => {
        let followed = false;
        saved = (await library.build('acc', 'movie', at, list, { onTimings: (time) => (followed = !!time.rulesFollowed) })).saved;
        return followed;
      };

      // A merged title (the misspelt one) gets a TMDB id: the merge follows it.
      const tmdbOnSource = before.map((item) => (item.id === 2 ? { ...item, tmdbId: '278' } : item));
      expect(await update(tmdbOnSource, '2026-01-03T00:00:00Z')).toBe(true);
      expect(await titles()).toEqual([3]);

      // The title they were merged into gets one too, and another year: both merges follow it.
      const tmdbOnTarget = tmdbOnSource.map((item) =>
        item.id === 1 ? { ...item, name: 'The Shawshank Redemption (1995)', tmdbId: '279' } : item,
      );
      expect(await update(tmdbOnTarget, '2026-01-04T00:00:00Z')).toBe(true);
      expect(await titles()).toEqual([3]);

      // The same as a whole build with the rules the device now holds; nothing changes the next time.
      const fresh = createNodeSqlDatabase();
      const freshLibrary = createSqlLibrary(fresh, async () => undefined);
      await freshLibrary.open('acc');
      const rules = await db.query('SELECT account, kind, rule, src, dst FROM title_rules');
      expect(rules).toHaveLength(2);
      await fresh.run([{ sql: 'INSERT INTO title_rules VALUES (?, ?, ?, ?, ?)', rows: rules }]);
      const whole = await freshLibrary.build('acc', 'movie', '2026-01-04T00:00:00Z', tmdbOnTarget);
      expect(await contents(db, library, saved)).toEqual(await contents(fresh, freshLibrary, whole.saved));
      expect(
        await update(
          tmdbOnTarget.map((item) => ({ ...item })),
          '2026-01-05T00:00:00Z',
        ),
      ).toBe(false);

      // Both titles end up with the same TMDB id: the merge between them is no longer needed.
      const same = tmdbOnTarget.map((item) => (item.id === 2 ? { ...item, name: 'Shawshank Redemtion (1995) 720p', tmdbId: '279' } : item));
      expect(await update(same, '2026-01-06T00:00:00Z')).toBe(true);
      expect(await titles()).toEqual([3]);
      expect(await db.query("SELECT COUNT(*) FROM title_rules WHERE rule = 'merge'")).toEqual([[1]]);
    }, 60_000);

    it('builds a new library beside the last one when many items changed (D-135)', async () => {
      const before = items(600);
      const after = before.map((item, index) => (index % 3 === 0 ? { ...item, name: `${String(item.name)} Again` } : item));
      const db = createNodeSqlDatabase();
      const library = createSqlLibrary(db, async () => undefined);
      const first = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', before);
      let inPlace: boolean | null = null;
      const second = await library.build('acc', 'movie', '2026-01-02T00:00:00Z', after, { onTimings: (time) => (inPlace = time.inPlace) });
      expect(inPlace).toBe(false);
      expect(second.saved.table).not.toBe(first.saved.table);
      const fresh = createNodeSqlDatabase();
      const freshLibrary = createSqlLibrary(fresh, async () => undefined);
      const whole = await freshLibrary.build('acc', 'movie', '2026-01-02T00:00:00Z', after);
      expect(await contents(db, library, second.saved)).toEqual(await contents(fresh, freshLibrary, whole.saved));
    });

    it('keeps the library when nothing changed, and only moves its date', async () => {
      const db = createNodeSqlDatabase();
      const library = createSqlLibrary(db, async () => undefined);
      const list = items(300);
      const first = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', list);
      const fractions: number[] = [];
      let changedKeys: number | null = null;
      const second = await library.build('acc', 'movie', '2026-01-02T00:00:00Z', [...list].reverse(), {
        onProgress: (fraction) => fractions.push(fraction),
        onTimings: (time) => (changedKeys = time.changedKeys),
      });
      expect(changedKeys).toBe(0);
      expect(second.changes).toEqual({ added: 0, changed: 0, removed: 0 });
      // The list in another order has another fingerprint: it was compared, and the new fingerprint is kept (D-135).
      expect(second.saved).toEqual({ ...first.saved, builtAt: '2026-01-02T00:00:00Z', fingerprint: listFingerprint([...list].reverse()) });
      expect(second.saved.fingerprint).not.toBe(first.saved.fingerprint);
      expect((await library.open('acc')).movie).toEqual(second.saved);
      expect(fractions.at(-1)).toBe(1);
      // No table of the unfinished build is left.
      await vi.waitFor(async () => expect(await leftovers(db, first.saved.table)).toEqual([]));
    });

    it('knows the same list again by its fingerprint: nothing is read or compared (D-135)', async () => {
      const db = createNodeSqlDatabase();
      const library = createSqlLibrary(db, async () => undefined);
      const list = items(300);
      const first = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', list);
      expect(first.saved.fingerprint).toBe(listFingerprint(list));
      let timings: LibraryBuildTimings | null = null;
      const again = await library.build(
        'acc',
        'movie',
        '2026-01-02T00:00:00Z',
        list.map((item) => ({ ...item })),
        {
          onTimings: (time) => (timings = time),
        },
      );
      expect(timings).toMatchObject({ sameList: true, newNames: 0, compare: 0, changedKeys: 0 });
      expect(again.saved).toEqual({ ...first.saved, builtAt: '2026-01-02T00:00:00Z' });
      expect(again.changes).toEqual({ added: 0, changed: 0, removed: 0 });
      expect((await library.open('acc')).movie).toEqual(again.saved);

      // Saved by native code with its fingerprint: the same once more, then another list is compared as before.
      const saveNative = async (fingerprint: string, rows: Item[]) => {
        const table = await library.createItems();
        await db.run([
          {
            sql: `INSERT INTO ${table}_r (sid, name, cat, poster, rating, added, released, ext, tmdb, ryear) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            rows: rows.map((item) => [
              String(item.id),
              String(item.name),
              item.categoryId ?? null,
              null,
              null,
              null,
              null,
              'mkv',
              null,
              null,
            ]),
          },
        ]);
        return { table, fingerprint };
      };
      const native = await library.build('acc', 'movie', '2026-01-03T00:00:00Z', await saveNative('n1:aaa', list.slice(0, 50)));
      expect(native.saved.fingerprint).toBe('n1:aaa');
      const unneeded = await saveNative('n1:aaa', list.slice(0, 50));
      const nativeAgain = await library.build('acc', 'movie', '2026-01-04T00:00:00Z', unneeded, {
        onTimings: (time) => (timings = time),
      });
      expect(timings!.sameList).toBe(true);
      expect(nativeAgain.saved).toEqual({ ...native.saved, builtAt: '2026-01-04T00:00:00Z' });
      // The list saved for nothing is dropped in the background.
      const tablesOf = async (table: string) =>
        (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB ?", [`${table}*`])).length;
      await vi.waitFor(async () => expect(await tablesOf(unneeded.table)).toBe(0));
      const other = await library.build('acc', 'movie', '2026-01-05T00:00:00Z', await saveNative('n1:bbb', list.slice(0, 60)), {
        onTimings: (time) => (timings = time),
      });
      expect(timings!.sameList).toBe(false);
      expect(other.saved.count).toBeGreaterThan(native.saved.count);
      expect(other.saved.fingerprint).toBe('n1:bbb');
    });

    it('reports progress up to the end', async () => {
      const library = createSqlLibrary(createNodeSqlDatabase(), async () => undefined);
      const fractions: number[] = [];
      await library.build('acc', 'movie', '2026-01-01T00:00:00Z', items(200), { onProgress: (fraction) => fractions.push(fraction) });
      expect(fractions.length).toBeGreaterThan(10);
      expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
      expect(fractions.at(-1)).toBe(1);
    });

    it('makes an order the first time a list asks for it, and answers the same before and after', async () => {
      const db = createNodeSqlDatabase();
      const library = createSqlLibrary(db, async () => undefined);
      const { saved } = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', items(300));
      const orderTables = async () =>
        (await db.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB '${saved.table}_o*'`)).map((row) =>
          String(row[0]),
        );
      expect(await orderTables()).toEqual([]);
      const query = { sort: 'title', order: 'desc', categoryId: '2', limit: 30, offset: 3 } as const;
      const sorted = await library.list(saved, query);
      await vi.waitFor(async () => expect(await orderTables()).toEqual([`${saved.table}_ot1`]));
      expect(saved.orders).toEqual(['t1']);
      expect(await library.list(saved, query)).toEqual(sorted);
      // A later start knows it is made; orders asked for together are all kept.
      expect((await createSqlLibrary(db, async () => undefined).open('acc')).movie!.orders).toEqual(['t1']);
      await Promise.all([library.list(saved, { sort: 'title', order: 'asc' }), library.list(saved, { sort: 'released', order: 'desc' })]);
      await vi.waitFor(() => expect(saved.orders).toHaveLength(3));
      expect((await createSqlLibrary(db, async () => undefined).open('acc')).movie!.orders).toEqual(['t1', 't0', 'r1']);
    });

    it('starts from a library whose orders are columns (built before D-135)', async () => {
      const db = createNodeSqlDatabase();
      const library = createSqlLibrary(db, async () => undefined);
      const list = items(200);
      const { saved } = await library.build('acc', 'movie', '2026-01-01T00:00:00Z', list);
      // What a build before D-135 left: an order number per title, and no orders in the table of contents.
      await db.run([
        { sql: `ALTER TABLE ${saved.table} ADD COLUMN t0 INTEGER` },
        { sql: `CREATE TABLE o (m INTEGER NOT NULL)` },
        { sql: `INSERT INTO o (m) SELECT rowid FROM ${saved.table} ORDER BY title, IFNULL(year, -1), id` },
        { sql: `UPDATE ${saved.table} SET t0 = (SELECT rowid FROM o WHERE m = ${saved.table}.rowid)` },
        { sql: 'DROP TABLE o' },
        { sql: 'UPDATE library SET orders = NULL' },
      ]);
      const old = (await library.open('acc')).movie!;
      expect(old.orders).toBeNull();
      const byTitle = await library.list(old, { sort: 'title', order: 'asc', limit: 500 });
      expect(byTitle).toEqual(await library.list(saved, { sort: 'title', order: 'asc', limit: 500 }));
      const next = await library.build('acc', 'movie', '2026-01-02T00:00:00Z', [...list, { id: 5, name: 'New One (2020)' }]);
      expect(next.changes).toEqual({ added: 1, changed: 0, removed: 0 });
      expect((await library.list(next.saved, { sort: 'title', order: 'asc', limit: 500 })).total).toBe(byTitle.total + 1);
    });
  });
});
