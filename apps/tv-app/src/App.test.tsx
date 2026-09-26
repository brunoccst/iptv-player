import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform, StatusBar, type AlertButton } from 'react-native';
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
  variants: [variant('101', '4K · ENG'), variant('102', '1080p', 'mp4'), variant('103', 'CAM', 'mp4')],
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

    await fireEvent.press(await screen.findByTestId('row-movies-7-open'));
    await flush();
    expect(await screen.findByTestId('browse-movies')).toBeTruthy();
    expect(screen.getByTestId('chip-7')).toHaveProp('accessibilityState', { selected: true });
    expect(backend.calls.some((c) => c.url.pathname === '/api/library/movies' && c.url.searchParams.get('categoryId') === '7')).toBe(true);
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

    const rowCalls = backend.calls.filter((c) => c.url.pathname === '/api/library/movies' && c.url.searchParams.get('categoryId') === '7');
    expect(rowCalls.map((c) => c.url.searchParams.get('limit'))).toEqual(['10']);
    await fireEvent.press(await screen.findByTestId('row-movies-7-more'));
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

  it('Playback lets the user choose which audio decoders come first; the player gets the choice (D-059)', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/playback/live/7', { body: playback('http://relay/7.m3u8', 'm3u8') });
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    expect(screen.queryByTestId('menu-playback')).toBeNull(); // no FFmpeg in this build
    await fireEvent.press(screen.getByTestId('nav-account'));

    nativeState.ffmpegAudio = true;
    await fireEvent.press(screen.getByTestId('nav-account'));
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
      connection: JSON.stringify({ mode: 'server', serverUrl: 'http://api.test' }),
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
