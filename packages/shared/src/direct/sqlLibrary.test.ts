import { describe, expect, it } from 'vitest';
import type { LibraryListQuery } from '../api/apiClient';
import { createMemoryStorage } from '../stores/storage';
import { createFakePanel } from '../testing/fakePanel';
import { createNodeSqlDatabase } from '../testing/nodeSqlDatabase';
import { createDirectApiClient } from './directApiClient';
import { buildMasters } from './normalizer/pipeline';
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
    const masters = buildMasters('acc', 'movie', [{ id: 1, name: 'EN - Big Movie (2020)' }]);
    await createSqlLibrary(db, async () => undefined).save('acc', 'movie', '2026-01-01T00:00:00Z', masters);
    // The app closed while saving the next build.
    await db.run([{ sql: 'CREATE TABLE lib1 (id TEXT)' }, { sql: 'CREATE TABLE lib1_d (m INTEGER)' }]);
    const tables = async () => (await db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map((row) => row[0]);
    expect(await tables()).toContain('lib1_d');

    const library = createSqlLibrary(db, async () => undefined);
    const saved = (await library.open('acc')).movie!;
    expect(await tables()).not.toContain('lib1');
    expect(await tables()).not.toContain('lib1_d');
    expect(await library.list(saved, {})).toMatchObject({ total: 1, items: [{ title: 'Big Movie', year: 2020 }] });
    expect(await library.open('other')).toEqual({});
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
