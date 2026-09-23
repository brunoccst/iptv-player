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
