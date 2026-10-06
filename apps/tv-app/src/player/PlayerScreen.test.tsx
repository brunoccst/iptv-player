import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions, Platform } from 'react-native';
import { appLog, HOLD_THRESHOLD_MS, TAP_CHAIN_MS, SCRUB_DOUBLING_MS, type PlayTarget } from '@iptv/shared';
import { pressRemote } from '../../test/remoteMock';
import { playerState } from '../../test/tvMediaMock';
import { appContext, navStore, stores } from '../appContext';
import { playback, pressBack, setupApp, variant } from '../../test/utils';
import { GUIDE_HIDE_MS } from './GuideOverlay';
import { RECENT_HIDE_MS } from './RecentChannelsOverlay';
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

  it('logs what the provider sent instead of a video, and names "max connections" (D-074)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', ({ url }) => ({ body: playback(`http://relay/55.${url.searchParams.get('container')}`) }));
    backend.on('GET', '/55.mkv', { body: 'Error: max connections reached' });
    backend.on('GET', '/55.m3u8', { body: 'Error: max connections reached' });
    await render(<PlayerScreen target={movie} />);
    await flush();
    const notVideo = {
      message: 'Source error',
      code: 'ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED',
      detail: 'None of the available extractors',
    };
    await act(async () => playerState.props?.onError?.({ nativeEvent: notVideo } as never));
    await flush();
    await act(async () =>
      playerState.props?.onError?.({ nativeEvent: { ...notVideo, code: 'ERROR_CODE_PARSING_MANIFEST_MALFORMED' } } as never),
    );
    await flush();
    expect(await screen.findByText(/all connections of the account are in use/)).toBeTruthy();
    expect(appLog.text()).toMatch(
      /attempt 1: the provider answered HTTP 200, application\/json, .* from relay: ""Error: max connections reached""/,
    );
    expect(appLog.text()).toMatch(/attempt 2: the provider answered HTTP 200/);
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

  it('headphones disconnected: the player paused itself, so the screen shows Play and Play resumes (#83)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    expect(playerState.props?.paused).toBe(false);

    await act(async () =>
      playerState.props?.onStatus?.({ nativeEvent: { state: 'ready', isPlaying: false, pausedByAudioOutput: true } } as never),
    );
    expect(playerState.props?.paused).toBe(true);
    expect(screen.getByLabelText('Play')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Play'));
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

  it('presses in a row go faster, release-only arrows and ⏩ too: the bar previews, the video jumps once (issue #121)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    await progress(100, 6000);

    // Remotes that report arrows only on release: no hold, so each press counts.
    for (let i = 0; i < 4; i++) {
      await act(async () => pressRemote('right', 'up'));
      await act(async () => jest.advanceTimersByTime(300));
    }
    expect(playerState.seeks).toEqual([110_000]);
    expect(screen.getByTestId('scrub-bar')).toBeTruthy();
    expect(screen.getByTestId('scrub-step')).toHaveTextContent('+2:00');
    await act(async () => pressRemote('fastForward', 'down'));
    expect(screen.getByTestId('scrub-step')).toHaveTextContent('+5:00');
    await act(async () => jest.advanceTimersByTime(TAP_CHAIN_MS));
    // 110 + 30 + 60 + 120 + 300 (D-150)
    expect(playerState.seeks).toEqual([110_000, 620_000]);
    expect(screen.queryByTestId('scrub-bar')).toBeNull();
  });

  it('the ±10 s buttons skip further when pressed in a row: 10 s, 30 s, 1 min (D-150)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    await progress(1000, 6000);

    const forward = () => fireEvent.press(screen.getByLabelText('Forward 10 seconds'));
    await act(async () => forward());
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => forward());
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => forward());
    expect(playerState.seeks).toEqual([1_010_000, 1_040_000, 1_100_000]);
    expect(screen.getByTestId('tap-flash-seconds')).toHaveTextContent('+1:00');
    await act(async () => jest.advanceTimersByTime(300));
    // The other way starts again at 10 s; so does a pause.
    await act(async () => fireEvent.press(screen.getByLabelText('Back 10 seconds')));
    await act(async () => jest.advanceTimersByTime(TAP_CHAIN_MS));
    await act(async () => fireEvent.press(screen.getByLabelText('Back 10 seconds')));
    expect(playerState.seeks.slice(3)).toEqual([1_090_000, 1_080_000]);
    expect(screen.getByTestId('tap-flash-seconds')).toHaveTextContent('−10');
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

  it('TV: ↓ puts the focus on the on-screen buttons; the D-pad moves between them; Back returns to the video (D-075)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    expect(screen.getByTestId('player-toggle').props.focusable).toBe(false);

    await act(async () => pressRemote('down', 'down'));
    expect(screen.queryByTestId('quick-drawer')).toBeNull();
    expect(screen.queryByTestId('player-focus')).toBeNull();
    expect(screen.getByTestId('player-toggle').props).toMatchObject({ focusable: true, hasTVPreferredFocus: true });
    expect(screen.getByTestId('player-back').props.focusable).toBe(true);
    // On the buttons, ←/→ move the focus (native), not the video; Select presses the focused button.
    await act(async () => pressRemote('right', 'down'));
    await act(async () => pressRemote('right', 'up'));
    expect(playerState.seeks).toEqual([]);
    await fireEvent.press(screen.getByTestId('player-audio'));
    expect(screen.getByTestId('quick-drawer')).toBeTruthy();
    await act(async () => pressBack());

    // Back from the buttons returns to the video: the focus anchor is back, the buttons leave D-pad focus.
    await act(async () => pressRemote('down', 'down'));
    expect(screen.getByTestId('player-toggle').props.focusable).toBe(true);
    await act(async () => pressBack());
    expect(screen.getByTestId('player-focus')).toBeTruthy();
    expect(screen.getByTestId('player-toggle').props.focusable).toBe(false);

    // ↑ opens the same buttons with Back at the top left focused, not the drawer (D-101).
    await act(async () => pressRemote('up', 'down'));
    expect(screen.queryByTestId('quick-drawer')).toBeNull();
    expect(screen.getByTestId('player-back').props).toMatchObject({ focusable: true, hasTVPreferredFocus: true });
    expect(screen.getByTestId('player-toggle').props).toMatchObject({ focusable: true, hasTVPreferredFocus: false });
    await act(async () => pressBack());
    expect(screen.getByTestId('player-focus')).toBeTruthy();
    jest.restoreAllMocks();
  });

  it('episodes: previous/next episode buttons around ±10 s; "from the beginning" seeks to 0 (D-077)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
    backend.on('GET', '/api/playback/episode/e2', { body: playback('http://relay/e2.mp4', 'mp4') });
    stubShow(backend);
    const first: PlayTarget = { kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' };
    navStore.getState().push({ name: 'player', target: first });
    await render(<PlayerScreen target={first} />);
    await flush();
    await flush();
    await ready();
    await progress(600, 2400);

    // First episode: no previous one; the next one follows the +10 s button.
    expect(screen.queryByTestId('player-previous')).toBeNull();
    expect(screen.getByLabelText('Next episode: S01:E02')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('player-restart'));
    expect(playerState.seeks).toEqual([0]);
    await fireEvent.press(screen.getByTestId('player-next'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player', target: { streamId: 'e2', seriesId: 's1' } });
  });

  it('the episodes button opens the drawer on Episodes; the audio button on Audio', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
    stubShow(backend);
    const first: PlayTarget = { kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' };
    await render(<PlayerScreen target={first} />);
    await flush();
    await flush();
    await ready();

    await fireEvent.press(screen.getByTestId('player-episodes'));
    expect(screen.getByTestId('quick-drawer')).toBeTruthy();
    expect(screen.getByText('S01:E02 · Second')).toBeTruthy();
    expect(screen.queryByText('Default audio')).toBeNull();
    await act(async () => pressBack());

    await fireEvent.press(screen.getByTestId('player-audio'));
    expect(screen.getByText('Default audio')).toBeTruthy();
    expect(screen.queryByText('S01:E02 · Second')).toBeNull();
    await act(async () => pressBack());

    // Audio, Subtitles, Episodes on the bar, in the drawer's order, each opening its tab (D-102).
    const bar = screen.getAllByRole('button').map((button) => button.props.testID);
    expect(bar.filter((id) => ['player-audio', 'player-subtitles', 'player-episodes'].includes(id))).toEqual([
      'player-audio',
      'player-subtitles',
      'player-episodes',
    ]);
    await fireEvent.press(screen.getByTestId('player-subtitles'));
    expect(screen.getByLabelText('✓ Off')).toBeTruthy();
    expect(screen.queryByText('Default audio')).toBeNull();
    await act(async () => pressBack());

    // A lone track with no name of its own is "Default": its language tag is often wrong (D-090).
    const en = { type: 'audio', groupIndex: 0, trackIndex: 0, label: 'en', language: 'en', selected: true };
    await act(async () => playerState.props?.onTracks?.({ nativeEvent: { tracks: [en] } } as never));
    await fireEvent.press(screen.getByTestId('player-audio'));
    expect(screen.getByLabelText('✓ Default')).toBeTruthy();
    await act(async () => pressBack());

    // Several tracks with only their codes ("en") show the languages' names (D-089).
    const pt = { type: 'audio', groupIndex: 1, trackIndex: 0, label: 'pt', language: 'pt', selected: false };
    await act(async () => playerState.props?.onTracks?.({ nativeEvent: { tracks: [en, pt] } } as never));
    await fireEvent.press(screen.getByTestId('player-audio'));
    expect(screen.getByLabelText('✓ English')).toBeTruthy();
    expect(screen.getByLabelText('Portuguese')).toBeTruthy();
  });

  it('subtitles and audio picked in one title are what the next titles start with, matched by language (D-087)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    stubShow(backend);
    const tracksEvent = (tracks: object[]) => act(async () => playerState.props?.onTracks?.({ nativeEvent: { tracks } } as never));
    const episode: PlayTarget = { kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1', masterId: 'show-m' };
    const view = await render(<PlayerScreen target={episode} />);
    await flush();
    await tracksEvent([
      { type: 'audio', groupIndex: 0, trackIndex: 0, label: 'Deutsch', language: 'de', selected: true },
      { type: 'audio', groupIndex: 1, trackIndex: 0, label: 'English', language: 'en', selected: false },
      { type: 'text', groupIndex: 2, trackIndex: 0, label: 'English', language: 'en', selected: false },
      { type: 'text', groupIndex: 3, trackIndex: 0, label: 'Português', language: 'pt', selected: false },
    ]);
    // Nothing chosen yet: the player's defaults stay.
    expect(playerState.trackSelections).toEqual([]);
    await act(async () => pressRemote('down', 'down'));
    await fireEvent.press(screen.getByLabelText('English'));
    await fireEvent.press(screen.getByText('Subtitles'));
    await fireEvent.press(screen.getByLabelText('Português'));
    expect(playerState.trackSelections).toEqual(['audio:1:0', 'text:3:0']);
    expect(stores.profilePrefs.getState().prefs.p1?.playback).toEqual({
      audio: { language: 'en', label: 'English' },
      subtitles: { language: 'pt', label: 'Português' },
    });

    // A movie (its tracks in another order): the same languages are selected by themselves, once.
    playerState.trackSelections.length = 0;
    await view.rerender(<PlayerScreen target={movie} />);
    await flush();
    const movieTracks = [
      { type: 'audio', groupIndex: 0, trackIndex: 0, label: 'English', language: 'en', selected: false },
      { type: 'audio', groupIndex: 0, trackIndex: 1, label: 'Français', language: 'fr', selected: true },
      { type: 'text', groupIndex: 1, trackIndex: 0, label: 'Português', language: 'pt', selected: false },
    ];
    await tracksEvent(movieTracks);
    await tracksEvent(movieTracks);
    expect(playerState.trackSelections).toEqual(['text:1:0', 'audio:0:0']);
  });

  it('OpenSubtitles: once the stream plays, a subtitle is found, added, turned on and named for a moment (D-111)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    const find = jest
      .spyOn(appContext.subtitles, 'find')
      .mockResolvedValue({ language: 'en', label: 'English · OpenSubtitles', srt: '1\n00:00:01,000 --> 00:00:02,000\nHi\n' });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await act(async () =>
      playerState.props?.onTracks?.({
        nativeEvent: { tracks: [{ type: 'text', groupIndex: 1, trackIndex: 0, label: 'Deutsch', language: 'de', selected: false }] },
      } as never),
    );
    expect(find).not.toHaveBeenCalled();
    await ready();
    await flush();
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ streamId: '55' }), { trackLanguages: ['de'], year: null });
    expect(playerState.subtitles).toEqual([
      { text: '1\n00:00:01,000 --> 00:00:02,000\nHi\n', language: 'en', label: 'English · OpenSubtitles' },
    ]);
    expect(screen.getByTestId('player-notice')).toHaveTextContent('Subtitles: English · OpenSubtitles');
    // Once per stream, and the notice goes away.
    await ready();
    await flush();
    expect(find).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(4000));
    expect(screen.queryByTestId('player-notice')).toBeNull();
    find.mockRestore();
  });

  it('OpenSubtitles: says why when there is no subtitle, and adds none (D-111)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    const find = jest
      .spyOn(appContext.subtitles, 'find')
      .mockResolvedValue({ message: 'OpenSubtitles: the daily download limit is reached.' });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    await flush();
    expect(screen.getByTestId('player-notice')).toHaveTextContent('OpenSubtitles: the daily download limit is reached.');
    expect(playerState.subtitles).toEqual([]);
    find.mockRestore();
  });

  it('episodes: the last one has a previous-episode button only', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e2', { body: playback('http://relay/e2.mp4', 'mp4') });
    stubShow(backend);
    const second: PlayTarget = { kind: 'episode', streamId: 'e2', container: 'mp4', title: 'Show', seriesId: 's1' };
    navStore.getState().push({ name: 'player', target: second });
    await render(<PlayerScreen target={second} />);
    await flush();
    await flush();
    await ready();
    await progress(600, 2400);
    expect(screen.queryByTestId('player-next')).toBeNull();
    await fireEvent.press(screen.getByTestId('player-previous'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player', target: { streamId: 'e1', seriesId: 's1' } });
  });

  it('movies have "from the beginning" but no episode buttons', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
    await render(<PlayerScreen target={movie} />);
    await flush();
    await ready();
    await progress(600, 5400);
    expect(screen.getByLabelText('Play from the beginning')).toBeTruthy();
    expect(screen.queryByTestId('player-previous')).toBeNull();
    expect(screen.queryByTestId('player-next')).toBeNull();
  });

  it('episodes: Skip ahead opens 30 s … 3 min, cancels on re-press or Back; next-up offers the next episode', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
    stubShow(backend);
    await render(<PlayerScreen target={{ kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' }} />);
    await flush();
    await flush();
    await ready();
    await progress(10, 2400);

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
    expect(playerState.seeks).toEqual([70_000]);
    expect(screen.getByTestId('player-timeline')).toBeTruthy();
    expect(screen.queryByTestId('skip-ahead-60')).toBeNull();

    await progress(2394, 2400);
    expect(await screen.findByText('Next episode in 6')).toBeTruthy();
    expect(screen.getByText('S01:E02 · Second')).toBeTruthy();
  });

  it('episodes: Skip ahead is on screen for 10 s only, 5–15 s in (D-100)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
    stubShow(backend);
    await render(<PlayerScreen target={{ kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' }} />);
    await flush();
    await flush();
    await ready();
    await progress(4, 2400);
    expect(screen.queryByTestId('skip-ahead')).toBeNull();
    await progress(5, 2400);
    expect(screen.getByTestId('skip-ahead')).toBeTruthy();
    await progress(14, 2400);
    expect(screen.getByTestId('skip-ahead')).toBeTruthy();
    await progress(15, 2400);
    expect(screen.queryByTestId('skip-ahead')).toBeNull();
  });

  it('TV: ←/→ between the Skip ahead options and the next-up buttons move the focus, not the video', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/playback/episode/e1', { body: playback('http://relay/e1.mp4', 'mp4') });
    stubShow(backend);
    await render(<PlayerScreen target={{ kind: 'episode', streamId: 'e1', container: 'mp4', title: 'Show', seriesId: 's1' }} />);
    await flush();
    await flush();
    await ready();
    await progress(5, 2400);

    // Only the Skip ahead button: ←/→ still seek.
    await act(async () => pressRemote('right'));
    expect(playerState.seeks).toEqual([15_000]);
    // Back inside the 10 s the button is up (D-100).
    await progress(8, 2400);
    // Options open: walking them with →/← never seeks; the chosen option skips exactly its amount.
    await fireEvent.press(screen.getByTestId('skip-ahead'));
    await act(async () => pressRemote('right'));
    await act(async () => pressRemote('right'));
    await act(async () => pressRemote('left'));
    expect(playerState.seeks).toEqual([15_000]);
    await fireEvent.press(screen.getByLabelText('Skip ahead 2 minutes'));
    expect(playerState.seeks).toEqual([15_000, 128_000]);

    // Next-up: Play Now / Cancel are a row too.
    await progress(2394, 2400);
    expect(await screen.findByText('Next episode in 6')).toBeTruthy();
    await act(async () => pressRemote('right'));
    expect(playerState.seeks).toEqual([15_000, 128_000]);
    jest.restoreAllMocks();
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

    it('↓ shows the channels watched last; Select switches back; ↓ again reaches the buttons (issue #122)', async () => {
      jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
      stubGuide();
      const profileId = stores.session.getState().activeProfileId!;
      await stores.profilePrefs.getState().update(profileId, {
        recentChannels: [{ id: '8', name: 'Sports', logoUrl: null, categoryId: '1' }],
      });
      await render(<PlayerScreen target={news} />);
      await flush();
      // Playing News made it the newest.
      expect(stores.profilePrefs.getState().prefs[profileId]?.recentChannels?.map((c) => c.id)).toEqual(['7', '8']);

      await act(async () => pressRemote('down', 'down'));
      await flush();
      expect(screen.getByTestId('recent-channels')).toBeTruthy();
      expect(screen.getByTestId('recent-channel-7')).toHaveProp('accessibilityState', { selected: true });
      // The previous channel has the focus: one Select goes back to it.
      expect(screen.getByTestId('recent-channel-8')).toHaveProp('hasTVPreferredFocus', true);

      // ↓ below the channels: the player's buttons.
      await fireEvent(screen.getByTestId('recent-channels-more'), 'focus');
      expect(screen.queryByTestId('recent-channels')).toBeNull();
      expect(screen.getByTestId('player-controls')).toBeTruthy();
      await act(async () => pressBack());

      await act(async () => pressRemote('down', 'down'));
      await flush();
      await fireEvent.press(screen.getByTestId('recent-channel-8'));
      expect(screen.queryByTestId('recent-channels')).toBeNull();
      expect(navStore.getState().stack.at(-1)).toMatchObject({
        name: 'player',
        target: { kind: 'live', streamId: '8', title: 'Sports', categoryId: '1' },
      });
      jest.restoreAllMocks();
    });

    it('the channel strip closes with ↑, with Back, and by itself', async () => {
      jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
      stubGuide();
      await render(<PlayerScreen target={news} />);
      await flush();
      await act(async () => pressRemote('down', 'down'));
      expect(screen.getByTestId('recent-channels')).toBeTruthy();
      await act(async () => pressRemote('up', 'down'));
      expect(screen.queryByTestId('recent-channels')).toBeNull();
      expect(screen.queryByTestId('guide-overlay')).toBeNull();

      await act(async () => pressRemote('down', 'down'));
      await act(async () => pressBack());
      expect(screen.queryByTestId('recent-channels')).toBeNull();

      await act(async () => pressRemote('down', 'down'));
      await act(async () => jest.advanceTimersByTime(RECENT_HIDE_MS + 100));
      expect(screen.queryByTestId('recent-channels')).toBeNull();
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
      await progress(10, 2400);
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
      // The "+10" circle never takes the next taps, and goes once it has faded (D-097).
      expect(screen.getByTestId('tap-flash-forward')).toHaveProp('pointerEvents', 'none');
      await act(async () => jest.advanceTimersByTime(1000));
      expect(screen.queryByTestId('tap-flash-forward')).toBeNull();

      await act(async () => jest.advanceTimersByTime(1000));
      await act(async () => tap(width * 0.1));
      await act(async () => jest.advanceTimersByTime(100));
      await act(async () => tap(width * 0.1));
      expect(playerState.seeks.at(-1)).toBe(30_000);
    });

    it('more quick taps on the same side skip further: 10 s, 30 s, 1 min (D-150)', async () => {
      const backend = setupApp();
      backend.on('GET', '/api/playback/movie/55', { body: playback('http://relay/55.mkv') });
      await render(<PlayerScreen target={movie} />);
      await flush();
      await ready();
      await progress(100, 6000);
      const { width } = Dimensions.get('window');
      const tap = (x: number) => fireEvent.press(screen.getByTestId('player-focus'), { nativeEvent: { locationX: x } });

      await act(async () => tap(width * 0.9));
      for (let i = 0; i < 3; i++) {
        await act(async () => jest.advanceTimersByTime(200));
        await act(async () => tap(width * 0.9));
      }
      expect(playerState.seeks).toEqual([110_000, 140_000, 200_000]);
      expect(screen.getByTestId('tap-flash-seconds')).toHaveTextContent('+1:00');
    });
  });
});
