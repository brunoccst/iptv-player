import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HOLD_THRESHOLD_MS, SCRUB_DOUBLING_MS, type PlayTarget } from '@iptv/shared';
import { pressRemote } from '../../test/remoteMock';
import { playerState } from '../../test/tvMediaMock';
import { playback, pressBack, setupApp } from '../../test/utils';
import { PlayerScreen } from './PlayerScreen';

const movie: PlayTarget = { kind: 'movie', streamId: '55', container: 'mkv', title: 'Heat', subtitle: '4K' };

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

async function progress(positionS: number, durationS: number) {
  await act(async () =>
    playerState.props?.onProgress?.({
      nativeEvent: { positionMs: positionS * 1000, durationMs: durationS * 1000, bufferedMs: 0, isLive: false },
    } as never),
  );
}

async function ready() {
  await act(async () => playerState.props?.onStatus?.({ nativeEvent: { state: 'ready', isPlaying: true } } as never));
}

describe('PlayerScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('plays the original MKV via the relay (ExoPlayer) and falls back to HLS on a player error', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', ({ url }) => ({ body: playback(`http://relay/55.${url.searchParams.get('container')}`) }));

    await render(<PlayerScreen target={movie} />);
    await flush();
    expect(playerState.props?.source).toMatchObject({ uri: 'http://relay/55.mkv', isHls: false });

    await act(async () => playerState.props?.onError?.({ nativeEvent: { message: 'decoder', code: 'X' } } as never));
    await flush();
    expect(playerState.props?.source).toMatchObject({ uri: 'http://relay/55.m3u8', isHls: true });

    await act(async () => playerState.props?.onError?.({ nativeEvent: { message: 'Source error', code: 'X' } } as never));
    expect(await screen.findByText('Source error')).toBeTruthy();
  });

  it('keeps the controls and clock up while loading; hides them 4 s after playback starts', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(screen.getByTestId('player-time')).toBeTruthy();

    await ready();
    await progress(2, 30);
    expect(screen.getByTestId('player-time').props.children.join('')).toContain('0:02 / 0:30');
    await act(async () => jest.advanceTimersByTime(4_000));
    expect(screen.queryByTestId('player-time')).toBeNull();
  });

  it('keeps a focus anchor on screen so the remote reaches the player, except while the drawer has focusables', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();

    expect(screen.getByTestId('player-focus').props.hasTVPreferredFocus).toBe(true);
    await act(async () => pressRemote('down', 'down'));
    expect(screen.queryByTestId('player-focus')).toBeNull();
  });

  it('select pauses and resumes on key release (how Android TV reports it), not on press', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    await progress(8, 30);

    await act(async () => pressRemote('select', 'down'));
    expect(playerState.props?.paused).toBe(false);
    await act(async () => pressRemote('select', 'up'));
    expect(playerState.props?.paused).toBe(true);
    expect(screen.getByTestId('player-time')).toHaveTextContent(/0:08 \/ 0:30.*Paused/);
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(screen.getByTestId('player-time')).toBeTruthy();

    await act(async () => pressRemote('playPause', 'up'));
    expect(playerState.props?.paused).toBe(false);
  });

  it('tap ←/→ skips 10 s with a flash; holding scrubs with acceleration and seeks once on release', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    await progress(100, 6000);

    await act(async () => pressRemote('right', 'down'));
    await act(async () => pressRemote('right', 'up'));
    expect(playerState.seeks).toEqual([110_000]);
    expect(screen.getByTestId('tap-flash-forward')).toBeTruthy();

    await act(async () => pressRemote('left', 'down'));
    await act(async () => jest.advanceTimersByTime(HOLD_THRESHOLD_MS + SCRUB_DOUBLING_MS * 2));
    expect(screen.getByTestId('scrub-bar')).toBeTruthy();
    expect(screen.getByText('×4')).toBeTruthy();
    expect(playerState.seeks).toHaveLength(1);
    await act(async () => pressRemote('left', 'up'));
    expect(playerState.seeks).toHaveLength(2);
    expect(playerState.seeks[1]).toBeLessThan(110_000 - 30_000);
    expect(screen.queryByTestId('scrub-bar')).toBeNull();
  });

  it('↑/↓ opens the quick drawer; Back closes it before leaving the player', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await act(async () =>
      playerState.props?.onTracks?.({
        nativeEvent: {
          tracks: [
            { type: 'audio', groupIndex: 0, trackIndex: 0, label: 'English', language: 'en', selected: true },
            { type: 'audio', groupIndex: 1, trackIndex: 0, label: 'Español', language: 'es', selected: false },
          ],
        },
      } as never),
    );

    await act(async () => pressRemote('down', 'down'));
    expect(screen.getByTestId('quick-drawer')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Español'));
    expect(playerState.trackSelections).toEqual(['audio:1:0']);

    await act(async () => pressBack());
    expect(screen.queryByTestId('quick-drawer')).toBeNull();
  });

  it('episodes: Skip Intro jumps past the intro; next-up counts down and offers the next episode', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
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
        seasons: [
          {
            number: 1,
            name: 'Season 1',
            coverUrl: null,
            episodes: [
              {
                id: 'e1',
                seasonNumber: 1,
                episodeNumber: 1,
                title: 'Pilot',
                plot: null,
                durationSeconds: 2400,
                stillUrl: null,
                containerExtension: 'mp4',
              },
              {
                id: 'e2',
                seasonNumber: 1,
                episodeNumber: 2,
                title: 'Second',
                plot: null,
                durationSeconds: 2400,
                stillUrl: null,
                containerExtension: 'mp4',
              },
            ],
          },
        ],
      },
    });
    await render(<PlayerScreen target={{ kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' }} />);
    await flush();
    await flush();
    await ready();
    await progress(30, 2400);

    await fireEvent.press(screen.getByTestId('skip-intro'));
    expect(playerState.seeks).toEqual([90_000]);

    await progress(2394, 2400);
    expect(await screen.findByText('Next episode in 6')).toBeTruthy();
    expect(screen.getByText('S01:E02 · Second')).toBeTruthy();
  });

  it('live channels show LIVE and ignore left/right', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/live/7', { body: playback('http://relay/7.m3u8', 'm3u8') });
    await render(<PlayerScreen target={{ kind: 'live', streamId: '7', container: 'm3u8', title: 'News' }} />);
    await flush();

    expect(playerState.props?.source).toMatchObject({ uri: 'http://relay/7.m3u8', isHls: true });
    expect(screen.getByText('LIVE')).toBeTruthy();
    await act(async () => pressRemote('right', 'down'));
    await act(async () => pressRemote('right', 'up'));
    expect(playerState.seeks).toEqual([]);
  });
});
