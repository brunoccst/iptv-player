import { describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend } from '../testing/fakeBackend';
import type { MasterDetails } from '../api/types';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';
import { describeLibraryProgress, isLibraryProcessing, pageKey, selectVariant } from './libraryStore';

const config = { appName: 'Test', appSlug: 'test', apiBaseUrl: 'http://api.test' };

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
  const context = createAppContext({ config, storage, fetch: backend.fetch });
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

  it('describes direct-mode stages and backend job states', () => {
    expect(
      describeLibraryProgress([
        status('movie', { jobStatus: 'processing', stage: 'grouping', itemCount: 12345, parsedCount: 4000 }),
        status('series', { jobStatus: 'processing', stage: 'downloading' }),
      ]),
    ).toEqual(['Movies: grouping titles 4,000 of 12,345…', 'Series: downloading the list from your provider…']);
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
