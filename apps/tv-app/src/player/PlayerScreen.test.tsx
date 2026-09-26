import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions, Platform } from 'react-native';
import { HOLD_THRESHOLD_MS, SCRUB_DOUBLING_MS, type PlayTarget } from '@iptv/shared';
import { pressRemote } from '../../test/remoteMock';
import { playerState } from '../../test/tvMediaMock';
import { navStore } from '../appContext';
import { playback, pressBack, setupApp, variant } from '../../test/utils';
import { GUIDE_HIDE_MS } from './GuideOverlay';
import { playbackErrorText, PlayerScreen } from './PlayerScreen';

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

/** Series "Show" with two 40-minute episodes. */
function stubShow(backend: ReturnType<typeof setupApp>) {
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

  it('explains a provider refusal (HTTP 401/403) in plain words', () => {
    expect(playbackErrorText('Source error', 'HTTP 401 Unauthorized from panel')).toMatch(/^Your IPTV provider refused this stream/);
    expect(playbackErrorText('Source error', 'HTTP 403 Forbidden from panel')).toContain('(HTTP 403 Forbidden from panel)');
    expect(playbackErrorText('Source error', 'HTTP 404 Not Found from panel')).toBe('Source error (HTTP 404 Not Found from panel)');
  });

  it('names the codec the device could not decode, and stops instead of retrying the same file', async () => {
    const detail =
      'MediaCodecAudioRenderer error, index=1, format=Format(2, null, video/x-matroska, audio/eac3, null, -1, en), format_supported=YES (v: Decoder failed: c2.dolby.eac3.decoder.eac3)';
    expect(playbackErrorText('Source error', detail, 'ERROR_CODE_DECODING_FAILED')).toMatch(
      /^This device could not decode the audio of this title \(Dolby Digital Plus\)/,
    );
    expect(playbackErrorText('Source error', detail, 'ERROR_CODE_DECODING_FAILED', true)).toContain('Try Playback → FFmpeg first');
    expect(playbackErrorText('Source error', 'n0: None of the available extractors', 'ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED')).toMatch(
      /^The provider did not send a playable video/,
    );

    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', ({ url }) => ({ body: playback(`http://relay/55.${url.searchParams.get('container')}`) }));
    await render(<PlayerScreen target={movie} />);
    await flush();
    await act(async () =>
      playerState.props?.onError?.({ nativeEvent: { message: 'Source error', code: 'ERROR_CODE_DECODING_FAILED', detail } } as never),
    );
    await flush();
    expect(playerState.props?.source).toMatchObject({ uri: 'http://relay/55.mkv' });
    expect(await screen.findByText(/could not decode the audio of this title \(Dolby Digital Plus\)/)).toBeTruthy();
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
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:08 / 0:30');
    expect(screen.getByLabelText('Play')).toBeTruthy();
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

  it('a release-only → (what the emulator reports) still skips 10 s; a release-only ↓ opens the drawer', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    await progress(6, 30);

    await act(async () => pressRemote('right', 'up'));
    expect(playerState.seeks).toEqual([16_000]);
    await act(async () => pressRemote('down', 'up'));
    expect(screen.getByTestId('quick-drawer')).toBeTruthy();
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

  it('episodes: Skip ahead opens 30 s … 3 min, cancels on re-press or Back; next-up offers the next episode', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
    stubShow(backend);
    await render(<PlayerScreen target={{ kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' }} />);
    await flush();
    await flush();
    await ready();
    await progress(30, 2400);

    // Re-pressing the button cancels.
    await fireEvent.press(screen.getByTestId('skip-ahead'));
    expect(screen.getAllByText(/^(30 s|1 min|2 min|3 min)$/)).toHaveLength(4);
    await fireEvent.press(screen.getByTestId('skip-ahead'));
    expect(screen.queryByTestId('skip-ahead-30')).toBeNull();
    // Back cancels without leaving the player.
    await fireEvent.press(screen.getByTestId('skip-ahead'));
    await act(async () => pressBack());
    expect(screen.queryByTestId('skip-ahead-30')).toBeNull();
    expect(screen.getByTestId('skip-ahead')).toBeTruthy();
    expect(playerState.seeks).toEqual([]);
    // Choosing an option seeks from the current position and shows the controls with the timeline.
    await act(async () => jest.advanceTimersByTime(5000));
    expect(screen.queryByTestId('player-controls')).toBeNull();
    await fireEvent.press(screen.getByTestId('skip-ahead'));
    await fireEvent.press(screen.getByLabelText('Skip ahead 1 minute'));
    expect(playerState.seeks).toEqual([90_000]);
    expect(screen.getByTestId('player-timeline')).toBeTruthy();
    expect(screen.queryByTestId('skip-ahead-60')).toBeNull();

    await progress(2394, 2400);
    expect(await screen.findByText('Next episode in 6')).toBeTruthy();
    expect(screen.getByText('S01:E02 · Second')).toBeTruthy();
  });

  it('next-up continues in another version of the series when the playing one lacks the next episode (D-066)', async () => {
    const backend = setupApp();
    stubShow(backend);
    // "Show" has two versions: s1 (episodes 1–2, above) and s2 (German, episodes 1–3).
    backend.on('GET', '/api/library/series/show', {
      body: {
        id: 'show',
        title: 'Show',
        year: null,
        posterUrl: null,
        rating: null,
        bestQuality: null,
        variants: [variant('s1', 'ENG'), variant('s2', 'GER')],
      },
    });
    const ep = (id: string, n: number) => ({
      id,
      seasonNumber: 1,
      episodeNumber: n,
      title: `Folge ${n}`,
      plot: null,
      durationSeconds: 2400,
      stillUrl: null,
      containerExtension: 'mkv',
    });
    backend.on('GET', '/api/catalog/series/s2', {
      body: {
        summary: {
          id: 's2',
          name: 'GE - Show',
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
        seasons: [{ number: 1, name: 'Staffel 1', coverUrl: null, episodes: [ep('g1', 1), ep('g2', 2), ep('g3', 3)] }],
      },
    });
    backend.on('GET', '/api/playback/episode/e2', { body: playback('http://relay/e2.mp4', 'mp4') });
    const target: PlayTarget = { kind: 'episode', streamId: 'e2', container: 'mp4', title: 'Show', seriesId: 's1', masterId: 'show' };
    navStore.getState().push({ name: 'player', target });
    await render(<PlayerScreen target={target} />);
    for (let i = 0; i < 4; i++) await flush();
    await ready();
    await progress(2394, 2400);

    expect(await screen.findByText('S01:E03 · Folge 3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('play-next'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({
      name: 'player',
      target: { streamId: 'g3', seriesId: 's2', masterId: 'show', episodeNumber: 3 },
    });
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
  describe('live guide overlay (D-058)', () => {
    const news: PlayTarget = { kind: 'live', streamId: '7', container: 'm3u8', title: 'News', categoryId: '1' };
    const channel = (id: string, name: string) => ({
      id,
      name,
      categoryId: '1',
      number: Number(id),
      logoUrl: null,
      epgChannelId: null,
      hasCatchup: false,
    });
    function stubGuide() {
      const backend = setupApp();
      backend.on('GET', '/api/playback/live/7', { body: playback('http://relay/7.m3u8', 'm3u8') });
      const now = Date.now();
      const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
      backend.on('GET', '/api/epg', {
        body: {
          status: 'ready',
          totalChannels: 2,
          from: at(-30),
          to: at(150),
          updatedAt: null,
          channels: [
            { channel: channel('7', 'News'), programmes: [{ title: 'Evening News', description: null, start: at(-10), end: at(20) }] },
            {
              channel: channel('8', 'Sports'),
              programmes: [
                { title: 'Match Live', description: null, start: at(-5), end: at(25) },
                { title: 'Highlights', description: null, start: at(25), end: at(55) },
              ],
            },
          ],
        },
      });
      navStore.setState({
        stack: [
          { name: 'section', section: 'live' },
          { name: 'player', target: news },
        ],
      });
      return backend;
    }

    it('↑ opens a guide of the category over the playing channel; Select switches channel', async () => {
      const backend = stubGuide();
      await render(<PlayerScreen target={news} />);
      await flush();
      await act(async () => pressRemote('up', 'down'));
      await flush();

      expect(screen.getByTestId('guide-overlay')).toBeTruthy();
      expect(backend.calls.find((c) => c.url.pathname === '/api/epg')?.url.searchParams.get('categoryId')).toBe('1');
      expect(screen.getByTestId('guide-channel-7')).toHaveProp('accessibilityState', { selected: true });
      expect(screen.getByText(/Match Live/)).toBeTruthy();
      expect(screen.getByText(/^Next .* · Highlights$/)).toBeTruthy();
      // The stream keeps playing: same source, not paused.
      expect(playerState.props).toMatchObject({ source: { uri: 'http://relay/7.m3u8' }, paused: false });

      await fireEvent.press(screen.getByTestId('guide-channel-8'));
      expect(screen.queryByTestId('guide-overlay')).toBeNull();
      expect(navStore.getState().stack.at(-1)).toMatchObject({
        name: 'player',
        target: { kind: 'live', streamId: '8', title: 'Sports', subtitle: 'Match Live', categoryId: '1' },
      });
    });

    it('closes after a few seconds without input, and with Back', async () => {
      stubGuide();
      await render(<PlayerScreen target={news} />);
      await flush();
      await act(async () => pressRemote('up', 'down'));
      await flush();
      await act(async () => jest.advanceTimersByTime(GUIDE_HIDE_MS - 500));
      await fireEvent(screen.getByTestId('guide-channel-8'), 'focus');
      await act(async () => jest.advanceTimersByTime(GUIDE_HIDE_MS - 500));
      expect(screen.getByTestId('guide-overlay')).toBeTruthy();
      await act(async () => jest.advanceTimersByTime(1000));
      expect(screen.queryByTestId('guide-overlay')).toBeNull();

      await act(async () => pressRemote('up', 'down'));
      await flush();
      expect(screen.getByTestId('guide-overlay')).toBeTruthy();
      await act(async () => pressBack());
      expect(screen.queryByTestId('guide-overlay')).toBeNull();
      expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player' });
    });

    it('phones open it with the Guide button', async () => {
      jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
      stubGuide();
      await render(<PlayerScreen target={news} />);
      await flush();
      await fireEvent.press(screen.getByTestId('player-guide'));
      await flush();
      expect(screen.getByTestId('guide-overlay')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Close guide'));
      expect(screen.queryByTestId('guide-overlay')).toBeNull();
      jest.restoreAllMocks();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false));
    afterEach(() => jest.restoreAllMocks());

    it('turns to landscape while playing and back on close', async () => {
      const lock = jest.spyOn(ScreenOrientation, 'lockAsync').mockResolvedValue();
      const unlock = jest.spyOn(ScreenOrientation, 'unlockAsync').mockResolvedValue();
      const backend = setupApp();
      backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
      const view = await render(<PlayerScreen target={movie} />);
      await flush();
      expect(lock).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.LANDSCAPE);
      await view.unmount();
      expect(unlock).toHaveBeenCalled();
    });

    it('a tap still shows the controls while Skip ahead is on screen', async () => {
      const backend = setupApp();
      backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
      stubShow(backend);
      await render(<PlayerScreen target={{ kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' }} />);
      await flush();
      await ready();
      await progress(30, 2400);
      await act(async () => jest.advanceTimersByTime(5000));
      expect(screen.getByTestId('skip-ahead')).toBeTruthy();
      expect(screen.queryByTestId('player-controls')).toBeNull();
      await act(async () => fireEvent.press(screen.getByTestId('player-focus'), { nativeEvent: { locationX: 10 } }));
      expect(screen.getByTestId('player-timeline')).toBeTruthy();
    });

    it('a tap toggles the controls; a double tap on the right/left third seeks ±10 s', async () => {
      const backend = setupApp();
      backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
      await render(<PlayerScreen target={movie} />);
      await flush();
      await ready();
      await progress(30, 120);
      const { width } = Dimensions.get('window');
      const tap = (x: number) => fireEvent.press(screen.getByTestId('player-focus'), { nativeEvent: { locationX: x } });

      expect(screen.getByTestId('player-controls')).toBeTruthy();
      await act(async () => tap(width / 2));
      expect(screen.queryByTestId('player-controls')).toBeNull();

      await act(async () => jest.advanceTimersByTime(1000));
      await act(async () => tap(width * 0.9));
      await act(async () => jest.advanceTimersByTime(100));
      await act(async () => tap(width * 0.9));
      expect(playerState.seeks.at(-1)).toBe(40_000);
      // Controls stay as they were before the double tap (hidden).
      expect(screen.queryByTestId('player-controls')).toBeNull();

      await act(async () => jest.advanceTimersByTime(1000));
      await act(async () => tap(width * 0.1));
      await act(async () => jest.advanceTimersByTime(100));
      await act(async () => tap(width * 0.1));
      expect(playerState.seeks.at(-1)).toBe(30_000);
    });
  });
});
