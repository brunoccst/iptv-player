import { describe, expect, it } from 'vitest';
import { createTestAppContext } from '../testing/fakeBackend';
import { account, createFakeBackend } from '../testing/fakeBackend';
import type { MasterDetails } from '../api/types';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';
import { describeLibraryProgress, describeLibraryRefresh, isLibraryProcessing, pageKey, selectVariant, topRated } from './libraryStore';

const config = { appName: 'Test', appSlug: 'test' };

const variant = (streamId: string) => ({
  streamId,
  label: streamId,
  quality: null,
  source: null,
  audioLanguages: [],
  audioTag: null,
  isHdr: false,
  containerExtension: 'mp4',
  categoryId: null,
  rawTitle: streamId,
  subtitleLanguages: [],
});

const details: MasterDetails = {
  id: 'm1',
  title: 'Heat',
  year: 1995,
  posterUrl: null,
  rating: null,
  bestQuality: '4K',
  variants: [variant('best'), variant('other')],
};

function setup() {
  const backend = createFakeBackend();
  const storage = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [], activeProfileId: null }),
  });
  const context = createTestAppContext({ config, storage, backend });
  return { backend, context, library: context.stores.library };
}

describe('library store', () => {
  it('caches pages per query and shares in-flight requests', async () => {
    const { backend, library } = setup();
    backend.on('GET', '/api/library/movies', ({ url }) => ({ body: { total: 1, items: [{ id: url.searchParams.get('offset') }] } }));

    const [first, second] = await Promise.all([
      library.getState().loadPage('movies', { offset: 0 }),
      library.getState().loadPage('movies', { offset: 0 }),
    ]);
    await library.getState().loadPage('movies', { offset: 0 });
    await library.getState().loadPage('movies', { offset: 100 });

    expect(first).toBe(second);
    expect(backend.calls.map((c) => c.url.search)).toEqual(['?limit=100&offset=0', '?limit=100&offset=100']);
    expect(library.getState().pages[pageKey('movies', { offset: 0 })]?.status).toBe('success');

    await library.getState().loadPage('movies', { offset: 0 }, { force: true });
    expect(backend.calls).toHaveLength(3);
  });

  it('sends the sort, caches each order separately and forgets the choice on reset', async () => {
    const { backend, library } = setup();
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [], sorts: ['title'] } });

    library.getState().chooseSort('movies', { sort: 'title', order: 'desc' });
    await library.getState().loadPage('movies', { sort: 'title', order: 'desc' });
    await library.getState().loadPage('movies');

    expect(backend.calls.map((c) => c.url.search)).toEqual(['?limit=100&sort=title&order=desc', '?limit=100']);
    expect(pageKey('movies', { sort: 'title' })).not.toBe(pageKey('movies'));
    library.getState().reset();
    expect(library.getState().sortChoices).toEqual({});
  });

  it('records errors per key and keeps previous data', async () => {
    const { backend, library } = setup();
    backend.on('GET', '/api/library/series/m1', { body: details });
    await library.getState().loadDetails('series', 'm1');
    backend.on('GET', '/api/library/series/m1', { status: 502, body: { code: 'provider_unavailable' } });

    await expect(library.getState().loadDetails('series', 'm1', { force: true })).resolves.toBeNull();

    const resource = library.getState().details['series|m1']!;
    expect(resource.status).toBe('error');
    expect(resource.error?.code).toBe('provider_unavailable');
    expect(resource.data).toEqual(details);
  });

  it('selectVariant falls back to the best variant', () => {
    const { library } = setup();

    expect(selectVariant(library.getState(), details)?.streamId).toBe('best');
    library.getState().selectVariant('m1', 'other');
    expect(selectVariant(library.getState(), details)?.streamId).toBe('other');
    library.getState().selectVariant('m1', 'gone');
    expect(selectVariant(library.getState(), details)?.streamId).toBe('best');
  });

  it('invalidate drops cached data but keeps variant choices', async () => {
    const { backend, library } = setup();
    backend.on('GET', '/api/library/series/m1', { body: details });
    await library.getState().loadDetails('series', 'm1');
    library.getState().selectVariant('m1', 'other');

    backend.on('GET', '/api/library/status', { body: [] });
    await library.getState().refreshStatus();
    library.getState().invalidate();

    expect(library.getState().details).toEqual({});
    expect(library.getState().status.status).toBe('success');
    expect(library.getState().selectedVariants).toEqual({ m1: 'other' });
  });

  it('sync and status', async () => {
    const { backend, library } = setup();
    backend.on('POST', '/api/library/sync', { status: 202 });
    backend.on('GET', '/api/library/status', {
      body: [{ mediaKind: 'movie', jobStatus: 'pending', itemCount: 2, queuedAt: null, finishedAt: null, error: null, masterCount: 0 }],
    });

    await expect(library.getState().sync()).resolves.toBe(true);
    const statuses = await library.getState().refreshStatus();

    expect(isLibraryProcessing(statuses)).toBe(true);
    expect(isLibraryProcessing([])).toBe(false);
  });

  it('after sync the status shows the update, even with an older status read still in flight (D-119)', async () => {
    const { backend, library } = setup();
    const status = (jobStatus: string) => [
      { mediaKind: 'movie', jobStatus, itemCount: 2, queuedAt: null, finishedAt: null, error: null, masterCount: 5 },
    ];
    let running = false;
    let reads = 0;
    backend.on('POST', '/api/library/sync', () => {
      running = true;
      return { status: 202 };
    });
    // The first read (a watcher polling as `syncing` began) answers late, with the state from before the update.
    backend.on('GET', '/api/library/status', () => {
      reads++;
      if (reads === 1) return new Promise((resolve) => setTimeout(() => resolve({ body: status('done') }), 20));
      return { body: status(running ? 'processing' : 'done') };
    });

    const early = library.getState().refreshStatus();
    await expect(library.getState().sync()).resolves.toBe(true);
    await early;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(library.getState().syncing).toBe(false);
    expect(isLibraryProcessing(library.getState().status.data)).toBe(true);
  });

  it('after a refresh it says whether anything changed (D-119)', async () => {
    const { backend, library } = setup();
    const status = (jobStatus: string, changes: object | null) => [
      { mediaKind: 'movie', jobStatus, itemCount: 2, queuedAt: null, finishedAt: null, error: null, masterCount: 5, changes },
      { mediaKind: 'series', jobStatus, itemCount: 2, queuedAt: null, finishedAt: null, error: null, masterCount: 5, changes },
    ];
    let current = status('processing', null);
    backend.on('POST', '/api/library/sync', { status: 202 });
    backend.on('GET', '/api/library/status', () => ({ body: current }));

    await library.getState().sync();
    expect(library.getState().refreshNotice).toBeNull();
    current = status('done', { added: 0, changed: 0, removed: 0 });
    await library.getState().refreshStatus();
    expect(library.getState().refreshNotice).toBe('Your library is up to date: nothing new from your provider.');

    // Only once: later status reads (the app polls) do not bring it back after it was dismissed.
    library.getState().dismissRefreshNotice();
    await library.getState().refreshStatus();
    expect(library.getState().refreshNotice).toBeNull();

    current = status('processing', null);
    await library.getState().sync();
    current = status('done', { added: 1200, changed: 3, removed: 2 });
    await library.getState().refreshStatus();
    expect(library.getState().refreshNotice).toBe('Library updated: 2,400 new, 6 changed and 4 removed titles.');
  });

  it('describeLibraryRefresh: running, failed and first builds', () => {
    const base = { itemCount: 1, queuedAt: null, finishedAt: null, masterCount: 1 };
    expect(describeLibraryRefresh([{ ...base, mediaKind: 'movie', jobStatus: 'processing', error: null }])).toBeNull();
    expect(describeLibraryRefresh([{ ...base, mediaKind: 'movie', jobStatus: 'failed', error: 'HTTP 503' }])).toBe(
      'The library could not be updated: HTTP 503',
    );
    expect(describeLibraryRefresh([{ ...base, mediaKind: 'movie', jobStatus: 'done', error: null }])).toBe('Your library was updated.');
  });

  it('is cleared when the account signs out', async () => {
    const { backend, context, library } = setup();
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [] });
    backend.on('GET', '/api/library/movies', { status: 401 });
    await context.stores.session.getState().restore();
    library.getState().selectVariant('m1', 'x');

    await library.getState().loadPage('movies');

    expect(context.stores.session.getState().status).toBe('anonymous');
    expect(library.getState().selectedVariants).toEqual({});
    expect(library.getState().pages).toEqual({});
  });
});

describe('describeLibraryProgress', () => {
  const status = (mediaKind: string, extra: Record<string, unknown>) =>
    ({ mediaKind, jobStatus: 'done', itemCount: null, queuedAt: null, finishedAt: null, error: null, masterCount: 0, ...extra }) as never;

  it('is empty when nothing runs', () => {
    expect(describeLibraryProgress(null)).toEqual([]);
    expect(describeLibraryProgress([status('movie', { masterCount: 5 })])).toEqual([]);
  });

  it('describes the library stages and job states', () => {
    expect(
      describeLibraryProgress([
        status('movie', { jobStatus: 'processing', stage: 'grouping', itemCount: 12345, parsedCount: 4000 }),
        status('series', { jobStatus: 'processing', stage: 'downloading' }),
      ]),
    ).toEqual(['Movies: grouping 12,345 titles, 32%…', 'Series: downloading the list from your provider…']);
    expect(
      describeLibraryProgress([
        status('movie', { jobStatus: 'processing', stage: 'waiting', itemCount: 104200 }),
        status('series', { jobStatus: 'processing', stage: 'grouping', itemCount: 9000, parsedCount: 900 }),
      ]),
    ).toEqual(['Movies: 104,200 titles downloaded, grouping next…', 'Series: grouping 9,000 titles, 10%…']);
    expect(
      describeLibraryProgress([status('movie', { jobStatus: 'done', masterCount: 1500 }), status('series', { jobStatus: 'pending' })]),
    ).toEqual(['Movies: 1,500 titles ready', 'Series: waiting to start…']);
    expect(
      describeLibraryProgress([
        status('movie', { jobStatus: 'processing', itemCount: 900 }),
        status('series', { jobStatus: 'failed', error: 'HTTP 500' }),
      ]),
    ).toEqual(['Movies: grouping 900 titles…', 'Series: failed (HTTP 500)']);
  });
});

describe('topRated (issue #188)', () => {
  const card = (id: number, rating: number | null) => ({
    id: `m${id}`,
    title: `Movie ${id}`,
    year: 2026,
    posterUrl: null,
    rating,
    bestQuality: null,
    variantCount: 1,
  });

  it('the 10 best rated of the 100 titles added last, highest first; unrated ones never', () => {
    // Newest first: 120 titles, ratings 1…9 repeating; one unrated and one 0 among the newest.
    const newest = Array.from({ length: 120 }, (_, i) => card(i, i === 0 ? null : i === 1 ? 0 : (i % 9) + 1));
    newest[110] = card(110, 10);
    const top = topRated(newest);
    expect(top).toHaveLength(10);
    expect(top.map((item) => item.rating)).toEqual([9, 9, 9, 9, 9, 9, 9, 9, 9, 9]);
    // Ties keep the newest first; the 10 from beyond the 100 newest is not in.
    expect(top[0]!.id).toBe('m8');
    expect(top.some((item) => item.id === 'm110')).toBe(false);
    expect(topRated([card(1, null), card(2, 0)])).toEqual([]);
  });
});
