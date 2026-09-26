import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/apiClient';
import { isKidsCategory, withKidsFilter } from './kidsFilter';

describe('isKidsCategory', () => {
  it.each([
    'Kids',
    'DE | KINDER',
    'Kinderfilme',
    'EN - Children',
    'Cartoons',
    'Animation',
    'Disney+',
    'FR: Enfants',
    'KiKA',
    'Family Movies',
  ])('accepts %s', (name) => expect(isKidsCategory(name)).toBe(true));
  it.each(['Action', 'Horror', 'Adult Animation', 'XXX Kids', 'Sport', 'Kindle', 'News 18+'])('rejects %s', (name) =>
    expect(isKidsCategory(name)).toBe(false),
  );
});

function fakeApi() {
  const categories = {
    live: [
      { id: 'l1', name: 'Kids TV', kind: 'live' },
      { id: 'l2', name: 'News', kind: 'live' },
    ],
    movies: [
      { id: 'm1', name: 'Action', kind: 'movie' },
      { id: 'm2', name: 'Kinderfilme', kind: 'movie' },
    ],
    series: [{ id: 's1', name: 'Drama', kind: 'series' }],
  };
  const api = {
    catalog: {
      categories: vi.fn(async (section: keyof typeof categories) => categories[section]),
      liveChannels: vi.fn(async () => [
        { id: '1', categoryId: 'l1' },
        { id: '2', categoryId: 'l2' },
        { id: '3', categoryId: null },
      ]),
      movies: vi.fn(async () => [{ id: 'a', categoryId: 'm1' }]),
      series: vi.fn(async () => []),
    },
    library: { list: vi.fn(async () => ({ total: 0, items: [], sorts: ['title'] })) },
    epg: { grid: vi.fn(async () => ({})) },
  };
  return api;
}

describe('withKidsFilter', () => {
  it('passes everything through for regular profiles', async () => {
    const raw = fakeApi();
    const { api } = withKidsFilter(raw as unknown as ApiClient, () => false);
    expect(await api.catalog.categories('movies')).toHaveLength(2);
    await api.library.list('movies', { search: 'x' });
    expect(raw.library.list).toHaveBeenLastCalledWith('movies', { search: 'x' }, undefined);
  });

  it('keeps only kids categories, channels and titles for Kids profiles', async () => {
    const raw = fakeApi();
    const { api } = withKidsFilter(raw as unknown as ApiClient, () => true);

    expect((await api.catalog.categories('movies')).map((c) => c.id)).toEqual(['m2']);
    expect((await api.catalog.liveChannels(null)).map((c) => c.id)).toEqual(['1']);
    expect(await api.catalog.movies(null)).toEqual([]);

    await api.library.list('movies', { categoryId: 'm1', search: 'x' });
    expect(raw.library.list).toHaveBeenLastCalledWith('movies', { categoryId: 'm1', search: 'x', categoryIds: ['m2'] }, undefined);
    await api.epg.grid({ hours: 2 });
    expect(raw.epg.grid).toHaveBeenLastCalledWith({ hours: 2, categoryIds: ['l1'] }, undefined);
  });

  it('asks for an impossible category when the provider has no kids categories, so nothing is shown', async () => {
    const raw = fakeApi();
    const { api } = withKidsFilter(raw as unknown as ApiClient, () => true);
    await api.library.list('series');
    expect(raw.library.list).toHaveBeenLastCalledWith('series', { categoryIds: ['__kids-none__'] }, undefined);
  });
});

describe('Kids profile in the app context', () => {
  it('filters after switching to a Kids profile and drops what an adult profile loaded', async () => {
    const { createAppContext } = await import('../appContext');
    const { account, createFakeBackend, profile } = await import('../testing/fakeBackend');
    const { createMemoryStorage } = await import('../stores/storage');
    const { SESSION_STORAGE_KEY } = await import('../stores/sessionStore');
    const backend = createFakeBackend();
    const adult = profile('adult');
    const kid = { ...profile('kid'), isKids: true };
    const storage = createMemoryStorage({
      [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [adult, kid], activeProfileId: 'adult' }),
    });
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [adult, kid] });
    backend.on('GET', '/api/catalog/movies/categories', {
      body: [
        { id: 'm1', name: 'Action', kind: 'movie' },
        { id: 'm2', name: 'Kids', kind: 'movie' },
      ],
    });
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [], sorts: ['title'] } });
    const { stores } = createAppContext({
      config: { appName: 'T', appSlug: 't', apiBaseUrl: 'http://api.test' },
      storage,
      fetch: backend.fetch,
    });
    await stores.session.getState().restore();

    expect(await stores.catalog.getState().loadCategories('movies')).toHaveLength(2);
    stores.session.getState().selectProfile('kid');
    expect(stores.catalog.getState().categories).toEqual({});
    expect((await stores.catalog.getState().loadCategories('movies'))?.map((c) => c.id)).toEqual(['m2']);
    await stores.library.getState().loadPage('movies');
    expect(backend.calls.at(-1)?.url.searchParams.get('categoryIds')).toBe('m2');
  });

  it('uses the categories a parent picked; untouched sections keep the name rule (D-064)', async () => {
    const raw = fakeApi();
    const picked: Record<string, string[] | null> = { movies: ['m1'], live: [], series: null };
    const { api } = withKidsFilter(
      raw as unknown as ApiClient,
      () => true,
      (section) => picked[section] ?? null,
    );

    expect((await api.catalog.categories('movies')).map((c) => c.id)).toEqual(['m1']);
    expect((await api.catalog.movies(null)).map((m) => m.id)).toEqual(['a']);
    await api.library.list('movies');
    expect(raw.library.list).toHaveBeenLastCalledWith('movies', { categoryIds: ['m1'] }, undefined);
    // An empty choice shows nothing of that section.
    expect(await api.catalog.liveChannels(null)).toEqual([]);
    await api.epg.grid({});
    expect(raw.epg.grid).toHaveBeenLastCalledWith({ categoryIds: ['__kids-none__'] }, undefined);
  });
});
