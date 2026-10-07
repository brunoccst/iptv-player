import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, Platform, ScrollView, StatusBar, type AlertButton } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { BACKUP_FORMAT, createMemoryStorage, exportUserData } from '@iptv/shared';
import { navStore, playbackSettings, stores } from './appContext';
import { nativeState, playerState } from '../test/tvMediaMock';
import { account, playback, pressBack, profile, setupApp, variant } from '../test/utils';
import { App } from './App';

const master = {
  id: 'm1',
  title: 'Big Test Movie',
  year: 2020,
  posterUrl: null,
  rating: 8,
  bestQuality: '4K',
  variants: [
    { ...variant('101', '4K · ENG'), quality: '4K', audioLanguages: ['ENG'] },
    { ...variant('102', '1080p', 'mp4'), quality: '1080p' },
    { ...variant('103', 'CAM', 'mp4'), source: 'CAM' },
  ],
};

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

function stubLibrary(backend: ReturnType<typeof setupApp>) {
  backend.on('GET', '/api/library/movies', {
    body: {
      total: 1,
      items: [{ id: 'm1', title: 'Big Test Movie', year: 2020, posterUrl: null, rating: 8, bestQuality: '4K', variantCount: 3 }],
    },
  });
  backend.on('GET', '/api/library/series', { body: { total: 0, items: [] } });
  backend.on('GET', '/api/library/movies/m1', { body: master });
  backend.on('GET', '/api/catalog/movies/categories', { body: [] });
  backend.on('GET', '/api/catalog/series/categories', { body: [] });
  backend.on('GET', '/api/catalog/live/categories', { body: [] });
  backend.on('GET', '/api/catalog/movies/101', { body: null, status: 404 });
}

/** Phones: Home is a virtualized list; scrolling it to the end renders the rows further down. */
async function scrollHomeToEnd() {
  const home = await screen.findByTestId('home-screen');
  await act(async () => {
    fireEvent(home, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } });
    fireEvent(home, 'contentSizeChange', 400, 3000);
    fireEvent.scroll(home, {
      nativeEvent: {
        contentOffset: { x: 0, y: 2200 },
        contentSize: { width: 400, height: 3000 },
        layoutMeasurement: { width: 400, height: 800 },
      },
    });
  });
  await flush();
}

describe('App (TV)', () => {
  it('login → single profile auto-selected → home with rail', async () => {
    const backend = setupApp({ signedIn: false });
    stubLibrary(backend);
    backend.on('POST', '/api/auth/login', { body: { token: 't', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile] } });

    await render(<App />);
    await flush();
    await fireEvent.changeText(screen.getByTestId('login-server'), 'http://panel:8080');
    await fireEvent.changeText(screen.getByTestId('login-username'), 'demo');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'demo');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await flush();

    expect(backend.calls.find((c) => c.url.pathname === '/api/auth/login')?.body).toEqual({
      serverUrl: 'http://panel:8080',
      username: 'demo',
      password: 'demo',
    });
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(screen.getByLabelText('Movies')).toBeTruthy();
  });

  it('Home shows "Loading your library…" until the first list answers, then the hero (D-117)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    let answer: (response: { body: unknown }) => void = () => undefined;
    const movies = {
      total: 1,
      items: [{ id: 'm1', title: 'Big Test Movie', year: 2020, posterUrl: null, rating: 8, bestQuality: '4K', variantCount: 3 }],
    };
    backend.on('GET', '/api/library/movies', () => new Promise((resolve) => (answer = resolve)));

    await render(<App />);
    await flush();
    expect(await screen.findByTestId('home-loading')).toBeTruthy();
    expect(screen.getByText('Loading your library…')).toBeTruthy();

    await act(async () => answer({ body: movies }));
    await flush();
    expect(screen.queryByTestId('home-loading')).toBeNull();
    expect(await screen.findByTestId('hero-play')).toBeTruthy();
  });

  it('TV Home: Left at Play and Right at More Info stay in the hero, and focusing them shows the whole banner (D-152)', async () => {
    const isTV = jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    stubLibrary(setupApp());
    await render(<App />);
    await flush();
    const play = await screen.findByTestId('hero-play');
    const actions = screen.getByTestId('hero-actions');
    expect(actions.props).toMatchObject({ trapFocusLeft: true, trapFocusRight: true });
    expect(actions.props.trapFocusUp).toBeFalsy();
    expect(actions.props.trapFocusDown).toBeFalsy();
    expect(within(actions).getByTestId('hero-info')).toBeTruthy();
    expect(within(actions).getByTestId('hero-play')).toBe(play);

    // Up from the first row lands on Play: the page scrolls back to the top to show the banner.
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await fireEvent(play, 'focus');
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
    scrollTo.mockClear();
    await fireEvent(screen.getByTestId('hero-info'), 'focus');
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
    scrollTo.mockRestore();
    isTV.mockRestore();
  });

  it('rows shown before the first library status stay; they reload only after an update (D-120)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    const status = (jobStatus: string) =>
      ['movie', 'series'].map((mediaKind) => ({
        mediaKind,
        jobStatus,
        itemCount: 1,
        queuedAt: null,
        finishedAt: null,
        error: null,
        masterCount: 1,
      }));
    let current = status('done');
    // The first status comes after Home shows (the saved library is still being read, D-120).
    let answerFirst: (response: { body: unknown }) => void = () => undefined;
    let first = true;
    backend.on('GET', '/api/library/status', () => {
      if (!first) return { body: current };
      first = false;
      return new Promise((resolve) => (answerFirst = resolve));
    });
    const movieLists = () => backend.calls.filter((call) => call.method === 'GET' && call.url.pathname === '/api/library/movies').length;

    await render(<App />);
    await flush();
    expect(await screen.findByTestId('hero-play')).toBeTruthy();
    const lists = movieLists();
    // The first status ("done") only confirms what Home shows: nothing reloads.
    await act(async () => answerFirst({ body: current }));
    await flush();
    expect(stores.library.getState().status.data).toHaveLength(2);
    expect(navStore.getState().libraryRevision).toBe(0);
    expect(movieLists()).toBe(lists);

    current = status('processing');
    await act(async () => void (await stores.library.getState().refreshStatus()));
    current = status('done');
    await act(async () => void (await stores.library.getState().refreshStatus()));
    await flush();
    expect(navStore.getState().libraryRevision).toBe(1);
    expect(movieLists()).toBeGreaterThan(lists);
  });

  it('after "Refresh library" it says the library is up to date, then the message goes (D-119)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    const status = (jobStatus: string, changes: object | null) =>
      ['movie', 'series'].map((mediaKind) => ({
        mediaKind,
        jobStatus,
        itemCount: 1,
        queuedAt: null,
        finishedAt: null,
        error: null,
        masterCount: 1,
        changes,
      }));
    let current = status('done', null);
    backend.on('POST', '/api/library/sync', () => {
      current = status('processing', null);
      return { status: 202 };
    });
    backend.on('GET', '/api/library/status', () => ({ body: current }));

    await render(<App />);
    await flush();
    await act(async () => void (await stores.library.getState().sync()));
    expect(screen.queryByTestId('library-notice')).toBeNull();

    current = status('done', { added: 0, changed: 0, removed: 0 });
    jest.useFakeTimers();
    await act(async () => void (await stores.library.getState().refreshStatus()));
    expect(screen.getByTestId('library-notice')).toHaveTextContent('Your library is up to date: nothing new from your provider.');
    await act(async () => jest.advanceTimersByTime(8000));
    expect(screen.queryByTestId('library-notice')).toBeNull();
    jest.useRealTimers();
  });

  it('shows provider login errors in plain language', async () => {
    const backend = setupApp({ signedIn: false });
    backend.on('POST', '/api/auth/login', { status: 401, body: { code: 'invalid_provider_credentials', detail: 'Invalid' } });
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Your IPTV provider rejected this username or password.')).toBeTruthy();
  });

  it('My List: the details button saves the title and Home shows a My List row (D-055)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/profiles/p1/watchlist', { body: [] });
    backend.on('PUT', '/api/profiles/p1/watchlist/movies/m1', ({ body }) => ({
      body: { section: 'movies', masterId: 'm1', ...(body as object), addedAt: '2026-09-25T00:00:00Z' },
    }));
    await render(<App />);
    await flush();
    await act(async () => void (await stores.watchlist.getState().load('p1', { force: true })));

    await act(async () => navStore.getState().push({ name: 'details', section: 'movies', masterId: 'm1' }));
    await flush();
    await fireEvent.press(screen.getByLabelText('Add Big Test Movie to My List'));
    await flush();
    expect(backend.calls.find((c) => c.method === 'PUT')?.body).toEqual({ title: 'Big Test Movie', year: 2020, posterUrl: null });
    expect(screen.getByLabelText('Remove Big Test Movie from My List')).toBeTruthy();

    pressBack();
    await flush();
    expect(screen.getByTestId('row-mylist')).toBeTruthy();
  });

  it('details: the eye button marks the movie as watched and back (D-104)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('PUT', '/api/profiles/p1/progress/movie/101', ({ body }) => ({
      body: { kind: 'movie', itemId: '101', updatedAt: '2026-09-27T00:00:00Z', ...(body as object) },
    }));
    backend.on('DELETE', '/api/profiles/p1/progress/movie/101', { status: 204 });
    await render(<App />);
    await flush();
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    await act(async () => navStore.getState().push({ name: 'details', section: 'movies', masterId: 'm1' }));
    await flush();

    expect(screen.queryByTestId('details-watched')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Mark as watched'));
    await flush();
    expect(backend.calls.find((c) => c.method === 'PUT')?.url.pathname).toBe('/api/profiles/p1/progress/movie/101');
    expect(screen.getByTestId('details-watched')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Mark as not watched'));
    await flush();
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/api/profiles/p1/progress/movie/101')).toBe(true);
    expect(screen.queryByTestId('details-watched')).toBeNull();
  });

  it('card menu: Add to My List and Remove from My List; the cover carries a bookmark while saved (D-104, issue #157)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/profiles/p1/watchlist', { body: [] });
    backend.on('PUT', '/api/profiles/p1/watchlist/movies/m1', ({ body }) => ({
      body: { section: 'movies', masterId: 'm1', ...(body as object), addedAt: '2026-09-25T00:00:00Z' },
    }));
    backend.on('DELETE', '/api/profiles/p1/watchlist/movies/m1', { status: 204 });
    await render(<App />);
    await flush();
    await act(async () => void (await stores.watchlist.getState().load('p1', { force: true })));
    await act(async () => navStore.getState().goSection('movies'));
    await flush();
    await screen.findAllByTestId('card-Big Test Movie');
    const card = () => screen.getAllByTestId('card-Big Test Movie').at(-1)!;
    expect(screen.queryByTestId('card-Big Test Movie-mylist')).toBeNull();

    await fireEvent(card(), 'longPress');
    await fireEvent.press(screen.getByTestId('card-menu-mylist-add'));
    await flush();
    expect(backend.calls.some((c) => c.method === 'PUT' && c.url.pathname === '/api/profiles/p1/watchlist/movies/m1')).toBe(true);
    expect(screen.getAllByTestId('card-Big Test Movie-mylist').length).toBeGreaterThan(0);

    await fireEvent(card(), 'longPress');
    expect(within(screen.getByTestId('card-menu')).getByText('Remove from My List')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('card-menu-mylist-remove'));
    await flush();
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/api/profiles/p1/watchlist/movies/m1')).toBe(true);
    expect(screen.queryByTestId('card-Big Test Movie-mylist')).toBeNull();
  });

  it('Continue Watching: holding OK opens the card menu; Remove clears the unfinished episodes of the series (D-078)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    const entry = (itemId: string, positionSeconds: number, updatedAt: string) => ({
      kind: 'episode',
      itemId,
      masterId: null,
      seriesId: 's1',
      seasonNumber: 1,
      episodeNumber: Number(itemId.slice(1)),
      title: 'Show',
      posterUrl: null,
      containerExtension: 'mp4',
      positionSeconds,
      durationSeconds: 2400,
      updatedAt,
    });
    backend.on('GET', '/api/profiles/p1/progress', {
      body: [entry('e1', 2395, '2026-09-01T00:00:00Z'), entry('e2', 600, '2026-09-02T00:00:00Z'), entry('e3', 900, '2026-09-03T00:00:00Z')],
    });
    backend.on('DELETE', '/api/profiles/p1/progress/episode/e2', { status: 204 });
    backend.on('DELETE', '/api/profiles/p1/progress/episode/e3', { status: 204 });
    await render(<App />);
    await flush();
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    await flush();
    expect(screen.getByTestId('row-continue')).toBeTruthy();

    await fireEvent(screen.getByTestId('card-Show'), 'longPress');
    expect(screen.getByTestId('card-menu')).toBeTruthy();
    expect(within(screen.getByTestId('card-menu')).getByText('S1:E3')).toBeTruthy();
    // No series title on these entries: no "Go to details"; the episode can be marked watched.
    expect(screen.queryByTestId('card-menu-details')).toBeNull();
    expect(within(screen.getByTestId('card-menu')).getByText('Mark episode as watched')).toBeTruthy();
    // Cancel closes it and keeps the row.
    await fireEvent.press(screen.getByTestId('card-menu-cancel'));
    expect(screen.queryByTestId('card-menu')).toBeNull();

    await fireEvent(screen.getByTestId('card-Show'), 'longPress');
    await fireEvent.press(screen.getByTestId('card-menu-remove'));
    await flush();
    expect(screen.queryByTestId('card-menu')).toBeNull();
    expect(screen.queryByTestId('row-continue')).toBeNull();
    // Only the unfinished episodes: e1 (finished) keeps its watched mark.
    expect(
      backend.calls
        .filter((c) => c.method === 'DELETE')
        .map((c) => c.url.pathname)
        .sort(),
    ).toEqual(['/api/profiles/p1/progress/episode/e2', '/api/profiles/p1/progress/episode/e3']);
  });

  it('card menu on a movie: Mark as watched puts the Watched tag on the cover and in details; Mark as not watched removes it (D-081)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('PUT', '/api/profiles/p1/progress/movie/101', ({ body }) => ({
      body: { kind: 'movie', itemId: '101', updatedAt: '2026-09-27T00:00:00Z', ...(body as object) },
    }));
    backend.on('DELETE', '/api/profiles/p1/progress/movie/101', { status: 204 });
    await render(<App />);
    await flush();
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    await act(async () => navStore.getState().goSection('movies'));
    await flush();
    await screen.findAllByTestId('card-Big Test Movie');

    const card = () => screen.getAllByTestId('card-Big Test Movie').at(-1)!;
    expect(screen.queryByTestId('card-Big Test Movie-watched')).toBeNull();
    await fireEvent(card(), 'longPress');
    expect(within(screen.getByTestId('card-menu')).getByText('Go to details')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('card-menu-watched'));
    await flush();
    const put = backend.calls.find((c) => c.method === 'PUT');
    expect(put?.url.pathname).toBe('/api/profiles/p1/progress/movie/101');
    expect(put?.body).toMatchObject({ masterId: 'm1', title: 'Big Test Movie' });
    expect(screen.getAllByTestId('card-Big Test Movie-watched').length).toBeGreaterThan(0);

    // The details show the same tag.
    await fireEvent(card(), 'longPress');
    await fireEvent.press(screen.getByTestId('card-menu-details'));
    await flush();
    expect(screen.getByTestId('details-watched')).toBeTruthy();
    await act(async () => pressBack());
    await flush();

    await fireEvent(card(), 'longPress');
    expect(within(screen.getByTestId('card-menu')).getByText('Mark as not watched')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('card-menu-unwatched'));
    await flush();
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/api/profiles/p1/progress/movie/101')).toBe(true);
    expect(screen.queryByTestId('card-Big Test Movie-watched')).toBeNull();
  });

  it('card menu on a series: Mark series as watched marks every episode and tags the cover (D-082)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/library/series', {
      body: {
        total: 1,
        items: [{ id: 'show', title: 'Show', year: 2020, posterUrl: null, rating: null, bestQuality: null, variantCount: 1 }],
      },
    });
    backend.on('GET', '/api/library/series/show', {
      body: { id: 'show', title: 'Show', year: 2020, posterUrl: null, rating: null, bestQuality: null, variants: [variant('s1', 'ENG')] },
    });
    const ep = (id: string, n: number) => ({
      id,
      seasonNumber: 1,
      episodeNumber: n,
      title: id,
      plot: null,
      durationSeconds: 2400,
      stillUrl: null,
      containerExtension: 'mp4',
    });
    backend.on('GET', '/api/catalog/series/s1', {
      body: {
        summary: {
          id: 's1',
          name: 'Show',
          categoryId: null,
          posterUrl: null,
          rating: null,
          plot: null,
          genre: null,
          releaseDate: null,
          lastModifiedAt: null,
        },
        cast: null,
        director: null,
        backdropUrls: [],
        trailerYoutubeId: null,
        seasons: [{ number: 1, name: 'Season 1', coverUrl: null, episodes: [ep('e1', 1), ep('e2', 2)] }],
      },
    });
    for (const id of ['e1', 'e2']) {
      backend.on('PUT', `/api/profiles/p1/progress/episode/${id}`, ({ body }) => ({
        body: { kind: 'episode', itemId: id, updatedAt: '2026-09-27T00:00:00Z', ...(body as object) },
      }));
      backend.on('DELETE', `/api/profiles/p1/progress/episode/${id}`, { status: 204 });
    }
    await render(<App />);
    await flush();
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    await act(async () => navStore.getState().goSection('series'));
    await flush();
    await screen.findAllByTestId('card-Show');
    const card = () => screen.getAllByTestId('card-Show').at(-1)!;

    await fireEvent(card(), 'longPress');
    await fireEvent.press(within(screen.getByTestId('card-menu')).getByText('Mark series as watched'));
    await flush();
    expect(
      backend.calls
        .filter((c) => c.method === 'PUT')
        .map((c) => c.url.pathname)
        .sort(),
    ).toEqual(['/api/profiles/p1/progress/episode/e1', '/api/profiles/p1/progress/episode/e2']);
    expect(screen.getAllByTestId('card-Show-watched').length).toBeGreaterThan(0);

    await fireEvent(card(), 'longPress');
    await fireEvent.press(within(screen.getByTestId('card-menu')).getByText('Mark series as not watched'));
    await flush();
    expect(backend.calls.filter((c) => c.method === 'DELETE')).toHaveLength(2);
    expect(screen.queryByTestId('card-Show-watched')).toBeNull();
  });

  it('opens a movie in another player app with the provider User-Agent (D-057)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/playback/movie/101', { body: playback('http://relay.test/101.mkv') });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<App />);
    await flush();
    await act(async () => navStore.getState().push({ name: 'details', section: 'movies', masterId: 'm1' }));
    await flush();

    await fireEvent.press(await screen.findByLabelText('Open Big Test Movie in another player'));
    await flush();
    expect(backend.calls.find((c) => c.url.pathname === '/api/playback/movie/101')?.url.searchParams.get('container')).toBe('mkv');
    expect(nativeState.calls).toContain(
      'external:http://relay.test/101.mkv:video/*:Big Test Movie:{"User-Agent":"VLC/3.0.21 LibVLC/3.0.21"}',
    );
    expect(alert).not.toHaveBeenCalled();

    nativeState.externalPlayerResult = 'none';
    await fireEvent.press(screen.getByLabelText('Open Big Test Movie in another player'));
    await flush();
    expect(alert).toHaveBeenCalledWith('Open in another player', 'No video player app is installed. Install one (e.g. VLC) and try again.');
    alert.mockRestore();
  });

  it('details: version picker, download with metadata, Back returns home', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/playback/movie/102', { body: playback('http://relay.test/102.mp4', 'mp4') });
    backend.on('GET', '/102.mp4', { status: 206, body: 'x' });
    await render(<App />);
    await flush();
    await act(async () => navStore.getState().push({ name: 'details', section: 'movies', masterId: 'm1' }));
    await flush();

    expect(await screen.findByText('4K · ENG (best)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('variant-button'));
    await fireEvent.press(screen.getByLabelText('1080p'));
    expect(stores.library.getState().selectedVariants).toEqual({ m1: '102' });
    expect(screen.getByTestId('variant-button')).toHaveTextContent('1080p');

    await fireEvent.press(screen.getByTestId('download-button'));
    await flush();
    expect(nativeState.calls).toEqual(['start:movie-102:http://relay.test/102.mp4:false']);
    expect(JSON.parse(nativeState.downloads[0]!.metadata)).toMatchObject({
      kind: 'movie',
      streamId: '102',
      title: 'Big Test Movie',
      masterId: 'm1',
    });

    await act(async () => pressBack());
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
  });

  it('top nav switches pages; typing a search opens results', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/catalog/live/channels', { body: [] });
    await render(<App />);
    await flush();

    await fireEvent.press(screen.getByTestId('nav-downloads'));
    expect(await screen.findByTestId('downloads-screen')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nav-live'));
    expect(await screen.findByTestId('live-screen')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nav-movies'));
    expect(await screen.findByTestId('browse-movies')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('nav-search'), 'big');
    expect(await screen.findByTestId('search-screen')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nav-search-clear'));
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
  });

  it('row titles open Movies on that category, like the web', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/catalog/movies/categories', { body: [{ id: '7', name: 'Drama', parentId: null }] });
    await render(<App />);
    await flush();
    await scrollHomeToEnd();

    await fireEvent.press(await screen.findByTestId('row-movies-7-open'));
    await flush();
    expect(await screen.findByTestId('browse-movies')).toBeTruthy();
    expect(screen.getByTestId('chip-7')).toHaveProp('accessibilityState', { selected: true });
    expect(backend.calls.some((c) => c.url.pathname === '/api/library/movies' && c.url.searchParams.get('categoryId') === '7')).toBe(true);
  });

  it('TV Home builds the first rows, then the next ones as the focus or the scroll moves down (D-122)', async () => {
    const isTV = jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    stubLibrary(backend);
    const categories = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id) => ({ id, name: `Category ${id}`, parentId: null }));
    backend.on('GET', '/api/catalog/movies/categories', { body: categories });
    backend.on('GET', '/api/library/series', {
      body: {
        total: 1,
        items: [{ id: 's1', title: 'Show A', year: 2021, posterUrl: null, rating: 7.5, bestQuality: null, variantCount: 1 }],
      },
    });
    const categoryRows = () =>
      backend.calls.filter((call) => call.url.pathname === '/api/library/movies' && call.url.searchParams.get('categoryId'));
    await render(<App />);
    await flush();

    // Continue Watching, My List, Live TV and Top rated movies: no category row yet, and none of their titles asked for.
    const topMovies = await screen.findByTestId('row-movies-top-rated');
    expect(screen.queryByTestId('row-series-all')).toBeNull();
    expect(screen.queryByTestId('row-movies-c1-open')).toBeNull();
    expect(categoryRows()).toHaveLength(0);

    // The focus on Top rated movies: the two rows below it (Top rated series, Series) are built.
    await act(async () => fireEvent(within(topMovies).getByTestId('card-Big Test Movie'), 'focus'));
    await flush();
    expect(screen.getByTestId('row-series-top-rated')).toBeTruthy();
    // The Top rated rows ask for the 100 titles added last and show the best rated of them, without "See all" (#188).
    const pools = backend.calls.filter((call) => call.url.searchParams.get('limit') === '100');
    expect(pools.map((call) => [call.url.pathname, call.url.searchParams.get('sort'), call.url.searchParams.get('order')])).toEqual([
      ['/api/library/movies', 'added', 'desc'],
      ['/api/library/series', 'added', 'desc'],
    ]);
    expect(screen.queryByTestId('row-movies-top-rated-open')).toBeNull();
    const seriesCard = within(screen.getByTestId('row-series-all')).getByTestId('card-Show A');
    expect(screen.queryByTestId('row-movies-c1-open')).toBeNull();

    // The focus on the Series row: the two rows below it are built.
    await act(async () => fireEvent(seriesCard, 'focus'));
    await flush();
    expect(screen.getByTestId('row-movies-c1-open')).toBeTruthy();
    expect(screen.getByTestId('row-movies-c2-open')).toBeTruthy();
    expect(screen.queryByTestId('row-movies-c3-open')).toBeNull();
    expect(categoryRows().map((call) => call.url.searchParams.get('categoryId'))).toEqual(['c1', 'c2']);

    // Scrolled near the end: two more.
    await act(async () =>
      fireEvent.scroll(screen.getByTestId('home-screen'), {
        nativeEvent: {
          contentOffset: { x: 0, y: 900 },
          contentSize: { width: 1920, height: 2000 },
          layoutMeasurement: { width: 1920, height: 1080 },
        },
      }),
    );
    await flush();
    expect(screen.getByTestId('row-movies-c4-open')).toBeTruthy();
    expect(screen.queryByTestId('row-movies-c5-open')).toBeNull();
    isTV.mockRestore();
  });

  it('Home rows show 10 titles and end with an arrow card that opens the category', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/catalog/movies/categories', { body: [{ id: '7', name: 'Drama', parentId: null }] });
    backend.on('GET', '/api/library/movies', ({ url }) => {
      const limit = Number(url.searchParams.get('limit'));
      const items = Array.from({ length: limit }, (_, i) => ({
        id: `m${i}`,
        title: `Movie ${i}`,
        year: 2020,
        posterUrl: null,
        rating: null,
        bestQuality: null,
        variantCount: 1,
      }));
      return { body: { total: 25, items } };
    });
    await render(<App />);
    await flush();
    await scrollHomeToEnd();

    const more = await screen.findByTestId('row-movies-7-more');
    const rowCalls = backend.calls.filter((c) => c.url.pathname === '/api/library/movies' && c.url.searchParams.get('categoryId') === '7');
    expect(rowCalls.map((c) => c.url.searchParams.get('limit'))).toEqual(['10']);
    await fireEvent.press(more);
    await flush();
    expect(await screen.findByTestId('browse-movies')).toBeTruthy();
    expect(screen.getByTestId('chip-7')).toHaveProp('accessibilityState', { selected: true });
  });

  it('the Live TV row arrow card opens Live TV on that category', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', parentId: null }] });
    const channels = Array.from({ length: 12 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Channel ${i + 1}`,
      categoryId: '1',
      number: i + 1,
      logoUrl: null,
      epgChannelId: null,
      hasCatchup: false,
    }));
    backend.on('GET', '/api/catalog/live/channels', { body: channels });
    backend.on('GET', '/api/epg', { body: { total: 0, channels: [] } });
    await render(<App />);
    await flush();

    expect(await screen.findByTestId('card-Channel 1')).toBeTruthy();
    expect(screen.queryByTestId('card-Channel 11')).toBeNull();
    await fireEvent.press(await screen.findByTestId('row-live-more'));
    await flush();
    expect(await screen.findByTestId('live-screen')).toBeTruthy();
    expect(screen.getByLabelText('News')).toHaveProp('accessibilityState', { selected: true });
  });

  it('once channels were watched, the live row lists them instead of the first category (issue #122)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', parentId: null }] });
    const profileId = stores.session.getState().activeProfileId!;
    await stores.profilePrefs.getState().update(profileId, {
      recentChannels: [
        { id: '9', name: 'Movies HD', logoUrl: null, categoryId: '2' },
        { id: '3', name: 'Kids TV', logoUrl: null, categoryId: '1' },
      ],
    });
    await render(<App />);
    await flush();

    expect(await screen.findByText('Recently watched channels')).toBeTruthy();
    expect(screen.queryByText('Live TV: News')).toBeNull();
    expect(screen.queryByTestId('row-live-more')).toBeNull();
    // The first category is not even downloaded.
    expect(backend.calls.some((c) => c.url.pathname === '/api/catalog/live/channels')).toBe(false);
    await fireEvent.press(screen.getByTestId('card-Kids TV'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player', target: { kind: 'live', streamId: '3', title: 'Kids TV' } });
  });

  it('phones start below the status bar (rounded corners, camera cut-out); the player and TVs use the full screen', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/playback/live/7', { body: playback('http://relay/7.m3u8', 'm3u8') });
    Object.defineProperty(StatusBar, 'currentHeight', { value: 48, configurable: true });
    const isTV = jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    await render(<App />);
    await flush();
    expect(screen.getByTestId('status-bar-space')).toHaveStyle({ height: 48 });

    await act(async () =>
      navStore.getState().push({ name: 'player', target: { kind: 'live', streamId: '7', container: 'm3u8', title: 'News' } }),
    );
    await flush();
    expect(screen.getByTestId('status-bar-space')).toHaveStyle({ height: 0 });

    isTV.mockReturnValue(true);
    await act(async () => navStore.getState().back());
    await flush();
    expect(screen.getByTestId('status-bar-space')).toHaveStyle({ height: 0 });
    isTV.mockRestore();
  });

  it("a title chosen in the TV home screen's Continue watching row plays from where it stopped (issue #165, D-147)", async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/playback/movie/101', { body: playback('http://relay/101.mp4', 'mp4') });
    const movie = {
      kind: 'movie',
      itemId: '101',
      masterId: 'm1',
      seriesId: null,
      seasonNumber: null,
      episodeNumber: null,
      title: 'Big Test Movie',
      posterUrl: null,
      containerExtension: 'mp4',
      positionSeconds: 1200,
      durationSeconds: 6000,
      updatedAt: '2026-10-01T10:00:00Z',
    };
    backend.on('GET', '/api/profiles/p1/progress', { body: [movie] });
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    const isTV = jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    // The app is started from the row.
    nativeState.watchNextLaunch = JSON.stringify(['p1', 'movie', '101']);
    await render(<App />);
    await flush();
    expect(navStore.getState().stack.map((route) => route.name)).toEqual(['section', 'details', 'player']);
    expect(playerState.props?.source).toMatchObject({ startPositionMs: 1_200_000 });

    // Chosen again while the app runs: Back from the player still lands on the details page.
    await act(async () => navStore.getState().goSection('series'));
    await act(async () => nativeState.openWatchNext(JSON.stringify(['p1', 'movie', '101'])));
    await flush();
    expect(navStore.getState().stack.map((route) => route.name)).toEqual(['section', 'details', 'player']);
    isTV.mockRestore();
  });

  it('Playback lets the user choose which audio decoders come first; the player gets the choice (D-059)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/playback/live/7', { body: playback('http://relay/7.m3u8', 'm3u8') });
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-library'));
    expect(screen.queryByTestId('menu-playback')).toBeNull(); // no FFmpeg in this build
    await fireEvent.press(screen.getByTestId('nav-account'));

    nativeState.ffmpegAudio = true;
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-library'));
    await fireEvent.press(await screen.findByTestId('menu-playback'));
    await fireEvent.press(await screen.findByTestId('audio-decoder-ffmpeg'));
    await flush();
    expect(playbackSettings.getState().audioDecoder).toBe('ffmpeg');
    await fireEvent.press(screen.getByTestId('playback-settings-close'));

    await act(async () =>
      navStore.getState().push({ name: 'player', target: { kind: 'live', streamId: '7', container: 'm3u8', title: 'News' } }),
    );
    await flush();
    expect(playerState.props?.source).toMatchObject({ uri: 'http://relay/7.m3u8', audioDecoder: 'ffmpeg' });
  });

  it('signs out from the account menu after confirming', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('POST', '/api/auth/logout', { status: 204, body: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-sign-out'));
    expect(screen.queryByTestId('login-submit')).toBeNull();
    const buttons = alert.mock.calls[0]![2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === 'Sign out')!.onPress!());
    await flush();

    expect(await screen.findByTestId('login-submit')).toBeTruthy();
    expect(stores.session.getState().status).toBe('anonymous');
  });

  it('Back up data encrypts the saved login into a file in the picked folder (D-056)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-library'));
    await fireEvent.press(screen.getByTestId('menu-backup'));
    await fireEvent.changeText(screen.getByTestId('backup-password'), 'correct horse');
    await fireEvent.changeText(screen.getByTestId('backup-confirm'), 'correct horse');
    await fireEvent.press(screen.getByTestId('backup-save'));
    expect(Directory.pickDirectoryAsync).toHaveBeenCalled();
    // Key stretching (PBKDF2, 100k rounds) takes a moment.
    const saved = await screen.findByText(/^Saved .*-backup-.*\.iptvbackup/, {}, { timeout: 10_000 });
    const name = /(\S+\.iptvbackup)/.exec(String(saved.props.children))![1]!;
    const text = await new File(Paths.document, name).text();
    expect(JSON.parse(text)).toMatchObject({ format: BACKUP_FORMAT });
    expect(text).not.toContain('tok');
  });

  it('Restore from backup on the login screen signs in with the restored data (D-056)', async () => {
    const backend = setupApp({ signedIn: false });
    stubLibrary(backend);
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [profile] });
    const old = createMemoryStorage({
      session: JSON.stringify({ token: 'restored', account, profiles: [profile], activeProfileId: 'p1' }),
    });
    const backup = new File(Paths.document, 'old-device.iptvbackup');
    const oldData = createMemoryStorage({ 'settings.playback': JSON.stringify({ audioDecoder: 'ffmpeg' }) });
    backup.write(await exportUserData({ secure: old, data: oldData, settingsKeys: ['settings.playback'] }, 'correct horse'));
    jest.mocked(File.pickFileAsync).mockResolvedValueOnce({ canceled: false, result: backup } as never);

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('login-restore'));
    await fireEvent.press(await screen.findByTestId('restore-pick'));
    expect(await screen.findByText('File: old-device.iptvbackup')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('restore-password'), 'wrong password');
    await fireEvent.press(screen.getByTestId('restore-submit'));
    expect(await screen.findByText('Wrong password, or the file is damaged.', {}, { timeout: 10_000 })).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('restore-password'), 'correct horse');
    await fireEvent.press(screen.getByTestId('restore-submit'));
    expect(await screen.findByTestId('home-screen', {}, { timeout: 10_000 })).toBeTruthy();
    expect(stores.session.getState()).toMatchObject({ status: 'authenticated', token: 'restored' });
    expect(playbackSettings.getState().audioDecoder).toBe('ffmpeg');
  });
});
