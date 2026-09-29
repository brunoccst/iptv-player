import { describe, expect, it } from 'vitest';
import { categoryLanguages, languageCategoryIds } from './contentLanguages';

describe('content language filter: category hint (D-086)', () => {
  it('reads the language a category name says', () => {
    expect(categoryLanguages('SRS | EN - ACTION')).toEqual(['ENG']);
    expect(categoryLanguages('SRS | DEUTSCH')).toEqual(['GER']);
    expect(categoryLanguages('SRS | FR - LATEST SERIES')).toEqual(['FRE']);
    expect(categoryLanguages('SRS | ITALY')).toEqual(['ITA']);
    expect(categoryLanguages('SRS | ARABIC [KIDS]')).toEqual(['ARA']);
    expect(categoryLanguages('VOD | PORTUGAL')).toEqual(['POR']);
    expect(categoryLanguages('VOD | DOCUMENTARIES FHD')).toEqual([]);
    expect(categoryLanguages('SRS | MULTI-LANG - NETFLIX')).toEqual([]);
    expect(categoryLanguages('Action & Adventure')).toEqual([]);
    expect(categoryLanguages('VOD | NOW IN CINEMAS')).toEqual([]);
  });

  it('reads Greek, Ex-Yu, Polish and Punjabi (D-107)', () => {
    expect(categoryLanguages('VOD | GR - MOVIES')).toEqual(['GRE']);
    expect(categoryLanguages('SRS | GREECE')).toEqual(['GRE']);
    expect(categoryLanguages('VOD | EXYU FILMOVI')).toEqual(['EXYU']);
    expect(categoryLanguages('VOD | EX-YU - DOMACI')).toEqual(['EXYU']);
    expect(categoryLanguages('SRS | ex yu serije')).toEqual(['EXYU']);
    expect(categoryLanguages('VOD | HRVATSKA')).toEqual(['EXYU']);
    expect(categoryLanguages('VOD | PL - FILMY')).toEqual(['POL']);
    expect(categoryLanguages('VOD | PUNJABI')).toEqual(['PAN']);
    // Not a language: "Apex" does not read as "Ex-Yu", "Grey" not as Greek.
    expect(categoryLanguages('VOD | APEX YUKON')).toEqual([]);
    expect(categoryLanguages('Grey Zone')).toEqual([]);
  });

  it('keeps categories in the chosen languages and those without a language', () => {
    const categories = [
      { id: '1', name: 'SRS | EN - ACTION' },
      { id: '2', name: 'SRS | DEUTSCH' },
      { id: '3', name: 'VOD | DOCUMENTARIES FHD' },
      { id: '4', name: 'SRS | TURKISH' },
    ];
    expect(languageCategoryIds(categories, ['GER'])).toEqual(['2', '3']);
    expect(languageCategoryIds(categories, ['ENG', 'TUR'])).toEqual(['1', '3', '4']);
  });
});

describe('library lists send the category hint with the content language filter (D-086)', () => {
  it('asks for the categories once and sends the hinted ids', async () => {
    const { createTestAppContext } = await import('../testing/fakeBackend');
    const { createFakeBackend, account, profile } = await import('../testing/fakeBackend');
    const { createMemoryStorage } = await import('../stores/storage');
    const backend = createFakeBackend();
    backend.on('POST', '/api/auth/login', { body: { token: 't', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile('p1')] } });
    backend.on('GET', '/api/profiles/p1/progress', { body: [] });
    backend.on('GET', '/api/profiles/p1/watchlist', { body: [] });
    backend.on('GET', '/api/catalog/movies/categories', {
      body: [
        { id: '1', name: 'VOD | EN - ACTION' },
        { id: '2', name: 'VOD | DEUTSCH' },
        { id: '3', name: 'VOD | DOCUMENTARIES FHD' },
      ],
    });
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [], sorts: ['title'] } });
    const context = createTestAppContext({
      config: { appName: 'T', appSlug: 't' },
      storage: createMemoryStorage(),
      backend,
    });
    await context.stores.session.getState().login({ serverUrl: 'http://p', username: 'u', password: 'p' });
    await context.stores.profilePrefs.getState().update('p1', { languages: ['GER'] });

    await context.api.library.list('movies');
    await context.api.library.list('movies', { categoryId: '3' });
    const lists = backend.calls.filter((call) => call.url.pathname === '/api/library/movies');
    expect(lists.map((call) => [call.url.searchParams.get('language'), call.url.searchParams.get('languageCategoryIds')])).toEqual([
      ['GER', '2,3'],
      ['GER', '2,3'],
    ]);
    expect(backend.calls.filter((call) => call.url.pathname === '/api/catalog/movies/categories')).toHaveLength(1);
  });
});
