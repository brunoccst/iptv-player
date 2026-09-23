import { downloadsStore } from '../appContext';
import { nativeState } from '../../test/tvMediaMock';
import { playback, setupApp } from '../../test/utils';

const target = { kind: 'movie' as const, streamId: '55', container: 'mkv', title: 'Heat', posterUrl: null };

describe('downloads store', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    downloadsStore.getState().dispose();
    jest.useRealTimers();
  });

  it('resolves a relay URL for the original container and queues a native download with metadata', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', ({ url }) => ({ body: playback(`http://api.test/api/relay/t/55.${url.searchParams.get('container')}`) }));
    backend.on('GET', '/api/relay/t/55.mkv', { status: 206, body: 'x' });
    downloadsStore.getState().init();

    await downloadsStore.getState().start(target);

    expect(nativeState.calls).toEqual(['start:movie-55:http://api.test/api/relay/t/55.mkv:false']);
    expect(downloadsStore.getState().records['movie-55']).toMatchObject({ state: 'queued', target: { title: 'Heat', streamId: '55' } });
  });

  it('polls progress while downloading and stops when done', async () => {
    setupApp();
    nativeState.downloads = [{ id: 'movie-1', state: 'downloading', percent: 10, bytesDownloaded: 1, metadata: JSON.stringify(target), failureReason: 0 }];
    downloadsStore.getState().init();
    expect(downloadsStore.getState().records['movie-1']?.progress).toBeCloseTo(0.1);

    nativeState.downloads[0] = { ...nativeState.downloads[0]!, percent: 60 };
    jest.advanceTimersByTime(1000);
    expect(downloadsStore.getState().records['movie-1']?.progress).toBeCloseTo(0.6);

    nativeState.downloads[0] = { ...nativeState.downloads[0]!, state: 'completed', percent: 100 };
    nativeState.emit();
    expect(downloadsStore.getState().records['movie-1']).toMatchObject({ state: 'completed', progress: 1 });
  });

  it('falls back to the panel HLS when the original file is missing', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', ({ url }) => ({ body: playback(`http://api.test/api/relay/t/55.${url.searchParams.get('container')}`) }));
    backend.on('GET', '/api/relay/t/55.m3u8', { body: '#EXTM3U' });

    await downloadsStore.getState().start(target);

    expect(nativeState.calls).toEqual(['start:movie-55:http://api.test/api/relay/t/55.m3u8:true']);
  });

  it('records start errors (e.g. provider down) per item', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { status: 502, body: { code: 'provider_unavailable', detail: 'Provider down' } });

    await downloadsStore.getState().start(target);

    expect(downloadsStore.getState().errors['movie-55']).toBe('This title is not available from the provider right now.');
    expect(nativeState.calls).toEqual([]);
  });

  it('ignores native entries with unreadable metadata', () => {
    setupApp();
    nativeState.downloads = [{ id: 'x', state: 'completed', percent: 100, bytesDownloaded: 1, metadata: 'not json', failureReason: 0 }];
    downloadsStore.getState().refresh();
    expect(downloadsStore.getState().records).toEqual({});
  });
});
