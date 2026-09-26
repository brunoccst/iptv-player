import { createNavStore, currentRoute } from './navStore';

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
