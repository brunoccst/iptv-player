import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { navStore, stores } from './appContext';
import { nativeState } from '../test/tvMediaMock';
import { account, playback, pressBack, profile, setupApp, variant } from '../test/utils';
import { App } from './App';

const master = { id: 'm1', title: 'Big Test Movie', year: 2020, posterUrl: null, rating: 8, bestQuality: '4K',
  variants: [variant('101', '4K · ENG'), variant('102', '1080p', 'mp4'), variant('103', 'CAM', 'mp4')] };

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

function stubLibrary(backend: ReturnType<typeof setupApp>) {
  backend.on('GET', '/api/library/movies', { body: { total: 1, items: [{ id: 'm1', title: 'Big Test Movie', year: 2020, posterUrl: null, rating: 8, bestQuality: '4K', variantCount: 3 }] } });
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

    expect(backend.calls.find((c) => c.url.pathname === '/api/auth/login')?.body).toEqual({ serverUrl: 'http://panel:8080', username: 'demo', password: 'demo' });
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

  it('details: version picker, download with metadata, Back returns home', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    backend.on('GET', '/api/playback/movie/102', { body: playback('http://relay.test/102.mp4', 'mp4') });
    backend.on('GET', '/102.mp4', { status: 206, body: 'x' });
    await render(<App />);
    await flush();
    await act(async () => navStore.getState().push({ name: 'details', section: 'movies', masterId: 'm1' }));
    await flush();

    expect(await screen.findByText('Version: 4K · ENG')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('variant-button'));
    await fireEvent.press(screen.getByLabelText('1080p'));
    expect(stores.library.getState().selectedVariants).toEqual({ m1: '102' });
    expect(screen.getByText('Version: 1080p')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('download-button'));
    await flush();
    expect(nativeState.calls).toEqual(['start:movie-102:http://relay.test/102.mp4:false']);
    expect(JSON.parse(nativeState.downloads[0]!.metadata)).toMatchObject({ kind: 'movie', streamId: '102', title: 'Big Test Movie', masterId: 'm1' });

    await act(async () => pressBack());
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
  });

  it('rail switches sections', async () => {
    const backend = setupApp();
    stubLibrary(backend);
    await render(<App />);
    await flush();

    await fireEvent.press(screen.getByTestId('rail-downloads'));
    expect(await screen.findByTestId('downloads-screen')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('rail-live'));
    expect(await screen.findByTestId('live-screen')).toBeTruthy();
  });
});
