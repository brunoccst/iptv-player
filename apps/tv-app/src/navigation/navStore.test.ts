import { createNavStore, currentRoute, playFromContinue } from './navStore';

describe('nav store', () => {
  it('pushes, replaces and pops; root cannot be popped', () => {
    const nav = createNavStore();
    nav.getState().push({ name: 'details', section: 'movies', masterId: 'm1' });
    nav.getState().push({ name: 'player', target: { kind: 'movie', streamId: '1', container: 'mkv', title: 'A' } });
    nav.getState().replaceTop({ name: 'player', target: { kind: 'movie', streamId: '2', container: 'mkv', title: 'A' } });

    expect(nav.getState().stack).toHaveLength(3);
    expect(currentRoute(nav.getState())).toMatchObject({ name: 'player', target: { streamId: '2' } });
    expect(nav.getState().back()).toBe(true);
    expect(nav.getState().back()).toBe(true);
    expect(nav.getState().back()).toBe(false);
  });

  it('goSection resets the stack', () => {
    const nav = createNavStore();
    nav.getState().push({ name: 'details', section: 'series', masterId: 's' });
    nav.getState().goSection('downloads');
    expect(nav.getState().stack).toEqual([{ name: 'section', section: 'downloads' }]);
  });
});

describe('nav store: web-style navigation', () => {
  it('typing a search opens the Search page; clearing it goes Home', () => {
    const nav = createNavStore();
    nav.getState().goSection('movies');
    nav.getState().setSearch('big');
    expect(currentRoute(nav.getState())).toEqual({ name: 'section', section: 'search' });
    nav.getState().setSearch('bigg');
    expect(nav.getState().stack).toHaveLength(1);
    nav.getState().setSearch('');
    expect(currentRoute(nav.getState())).toEqual({ name: 'section', section: 'home' });
  });

  it('opens a category, and Back closes the menu before leaving a page', () => {
    const nav = createNavStore();
    nav.getState().openCategory('movies', '7');
    expect(nav.getState()).toMatchObject({ categoryId: '7', stack: [{ name: 'section', section: 'movies' }] });
    nav.getState().push({ name: 'details', section: 'movies', masterId: 'm1' });
    nav.getState().setMenuOpen(true);
    nav.getState().setMenuGroup('App');
    // Back leaves the menu group first, then closes the menu.
    expect(nav.getState().back()).toBe(true);
    expect(nav.getState()).toMatchObject({ menuOpen: true, menuGroup: null });
    expect(nav.getState().back()).toBe(true);
    expect(nav.getState().menuOpen).toBe(false);
    expect(nav.getState().stack).toHaveLength(2);
  });
});

describe('nav store: Continue watching (issue #166)', () => {
  const progress = {
    containerExtension: 'mkv',
    durationSeconds: 3600,
    episodeNumber: 2,
    itemId: 'e2',
    kind: 'episode',
    masterId: 's1',
    positionSeconds: 600,
    posterUrl: null,
    seasonNumber: 1,
    seriesId: '9',
    title: 'Show',
    updatedAt: '2026-10-05T00:00:00Z',
  };

  it('plays over the details page, so Back from the player lands there', () => {
    const nav = createNavStore();
    playFromContinue(nav, progress);
    expect(currentRoute(nav.getState())).toMatchObject({ name: 'player', target: { streamId: 'e2', startAt: 600 } });
    expect(nav.getState().back()).toBe(true);
    expect(currentRoute(nav.getState())).toEqual({ name: 'details', section: 'series', masterId: 's1' });
    expect(nav.getState().back()).toBe(true);
    expect(currentRoute(nav.getState())).toEqual({ name: 'section', section: 'home' });
  });

  it('plays straight from Home when the entry has no details page', () => {
    const nav = createNavStore();
    playFromContinue(nav, { ...progress, kind: 'movie', masterId: null });
    expect(nav.getState().stack.map((route) => route.name)).toEqual(['section', 'player']);
  });
});
