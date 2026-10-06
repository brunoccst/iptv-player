import { act, renderHook } from '@testing-library/react-native';
import type { ProgressDto } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { currentRoute } from '../navigation/navStore';
import { nativeState } from '../../test/tvMediaMock';
import { account, profile, setupApp } from '../../test/utils';
import {
  openPendingWatchNext,
  parseWatchNextId,
  syncWatchNext,
  useWatchNextSync,
  WATCH_NEXT_DELAY_MS,
  watchNextEntries,
  watchNextId,
  watchNextOpen,
  watchNextPlan,
} from './watchNext';

const progress = (overrides: Partial<ProgressDto> & Pick<ProgressDto, 'itemId'>): ProgressDto => ({
  kind: 'movie',
  masterId: 'm1',
  seriesId: null,
  seasonNumber: null,
  episodeNumber: null,
  title: 'Big Test Movie',
  posterUrl: 'http://panel/poster.jpg',
  containerExtension: 'mp4',
  positionSeconds: 600,
  durationSeconds: 6000,
  updatedAt: '2026-10-01T10:00:00Z',
  ...overrides,
});

const movie = progress({ itemId: '101' });
const episode = progress({
  itemId: 'e7',
  kind: 'episode',
  masterId: 's-master',
  seriesId: 's1',
  seasonNumber: 2,
  episodeNumber: 7,
  title: 'Show',
  posterUrl: null,
  positionSeconds: 300,
  durationSeconds: 2400,
  updatedAt: '2026-10-02T10:00:00Z',
});

describe('Watch Next entries (issue #165, D-147)', () => {
  it("publishes the profile's Continue Watching, newest first, one per series, with position and poster", () => {
    const older = { ...episode, itemId: 'e6', episodeNumber: 6, updatedAt: '2026-09-30T10:00:00Z' };
    const finished = progress({ itemId: '102', positionSeconds: 5990 });
    const live = progress({ itemId: 'c1', kind: 'live' });
    const entries = watchNextEntries([movie, older, episode, finished, live], 'p1');
    expect(entries).toEqual([
      {
        id: watchNextId('p1', episode),
        type: 'episode',
        title: 'Show',
        season: 2,
        episode: 7,
        posterUrl: null,
        positionMs: 300_000,
        durationMs: 2_400_000,
        lastEngagementMs: Date.parse('2026-10-02T10:00:00Z'),
      },
      expect.objectContaining({ id: watchNextId('p1', movie), type: 'movie', season: null, posterUrl: 'http://panel/poster.jpg' }),
    ]);
  });

  it('ids carry the profile, kind and item and read back; anything else is not ours', () => {
    expect(parseWatchNextId(watchNextId('p|1', { kind: 'episode', itemId: 'a"b' }))).toEqual({
      profileId: 'p|1',
      kind: 'episode',
      itemId: 'a"b',
    });
    expect(parseWatchNextId('nonsense')).toBeNull();
    expect(parseWatchNextId('["only","two"]')).toBeNull();
  });
});

describe('Watch Next plan', () => {
  const [entry] = watchNextEntries([movie], 'p1');
  const row = { rowId: 5, id: entry!.id, browsable: true, positionMs: entry!.positionMs, lastEngagementMs: entry!.lastEngagementMs };

  it('inserts new titles, updates moved ones, removes the rest and duplicates', () => {
    const [moved] = watchNextEntries([{ ...movie, positionSeconds: 900, updatedAt: '2026-10-03T10:00:00Z' }], 'p1');
    expect(watchNextPlan([moved!], [row, { ...row, rowId: 6 }, { ...row, rowId: 7, id: 'gone' }])).toEqual({
      insert: [],
      update: [{ rowId: 5, entry: moved }],
      remove: [6, 7],
    });
    expect(watchNextPlan([entry!], [row])).toEqual({ insert: [], update: [], remove: [] });
    expect(watchNextPlan([entry!], [])).toEqual({ insert: [entry], update: [], remove: [] });
    expect(watchNextPlan([], [row])).toEqual({ insert: [], update: [], remove: [5] });
  });

  it('a title removed on the home screen stays removed until it is watched again', () => {
    const removed = { ...row, browsable: false };
    expect(watchNextPlan([entry!], [removed])).toEqual({ insert: [], update: [], remove: [] });
    const [again] = watchNextEntries([{ ...movie, positionSeconds: 900, updatedAt: '2026-10-03T10:00:00Z' }], 'p1');
    expect(watchNextPlan([again!], [removed])).toEqual({ insert: [again], update: [], remove: [5] });
  });

  it('syncs the native rows to the entries', async () => {
    nativeState.reset();
    await syncWatchNext(watchNextEntries([movie, episode], 'p1'));
    expect(nativeState.watchNext.map((r) => r.entry.title)).toEqual(['Show', 'Big Test Movie']);
    await syncWatchNext(watchNextEntries([movie], 'p1'));
    expect(nativeState.watchNext.map((r) => r.entry.title)).toEqual(['Big Test Movie']);
    await syncWatchNext([]);
    expect(nativeState.watchNext).toEqual([]);
  });
});

describe('Opening a title from the home screen', () => {
  beforeEach(async () => {
    setupApp();
    await stores.progress.getState().load('p1');
    stores.progress.setState({ profileId: 'p1', items: { data: [movie, episode], status: 'success', error: null, updatedAt: 0 } });
  });

  it('plays it from its position over its details page', () => {
    watchNextOpen.setState({ pending: watchNextId('p1', episode) });
    expect(openPendingWatchNext()).toBe(true);
    const { stack } = navStore.getState();
    expect(stack.map((r) => r.name)).toEqual(['section', 'details', 'player']);
    expect(stack[1]).toMatchObject({ section: 'series', masterId: 's-master' });
    expect(currentRoute(navStore.getState())).toMatchObject({ target: { kind: 'episode', streamId: 'e7', startAt: 300 } });
    expect(watchNextOpen.getState().pending).toBeNull();
  });

  it("waits for the profile's progress, and opens Home for a title no longer in Continue Watching", () => {
    stores.progress.setState({ profileId: 'p1', items: { data: null, status: 'loading', error: null, updatedAt: 0 } });
    watchNextOpen.setState({ pending: watchNextId('p1', { kind: 'movie', itemId: 'gone' }) });
    navStore.getState().goSection('movies');
    expect(openPendingWatchNext()).toBe(false);
    stores.progress.setState({ items: { data: [movie], status: 'success', error: null, updatedAt: 0 } });
    expect(openPendingWatchNext()).toBe(true);
    expect(navStore.getState().stack).toEqual([{ name: 'section', section: 'home' }]);
  });

  it("another profile's title only opens Home", () => {
    stores.session.setState({ profiles: [profile, { ...profile, id: 'p2' }], account, activeProfileId: 'p2' });
    watchNextOpen.setState({ pending: watchNextId('p1', movie) });
    expect(openPendingWatchNext()).toBe(true);
    expect(navStore.getState().stack).toEqual([{ name: 'section', section: 'home' }]);
  });
});

describe('Keeping the row in step', () => {
  afterEach(() => jest.useRealTimers());

  it("follows the active profile's progress a moment later, and empties at the profile picker", async () => {
    setupApp();
    await stores.progress.getState().load('p1');
    jest.useFakeTimers();
    const settle = async () => {
      await act(async () => {
        jest.advanceTimersByTime(WATCH_NEXT_DELAY_MS);
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
    };
    await renderHook(() => useWatchNextSync(true));
    await act(async () =>
      stores.progress.setState({ profileId: 'p1', items: { data: [movie], status: 'success', error: null, updatedAt: 0 } }),
    );
    expect(nativeState.watchNext).toEqual([]);
    await settle();
    expect(nativeState.watchNext.map((r) => r.id)).toEqual([watchNextId('p1', movie)]);

    await act(async () => stores.session.getState().selectProfile(null));
    await settle();
    expect(nativeState.watchNext).toEqual([]);
  });
});
