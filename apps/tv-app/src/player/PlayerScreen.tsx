import { useCallback, useEffect, useRef, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  BackHandler,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  appLog,
  describeProbe,
  probeHint,
  probeMessage,
  probeStream,
  errorMessage,
  NEXT_UP_COUNTDOWN_SECONDS,
  RemoteSeekController,
  SkipStreak,
  spareConnection,
  TAP_CHAIN_MS,
  clampTime,
  audioTrackLabels,
  trackLabel,
  episodeTarget,
  findProgress,
  liveTarget,
  offlineAccess,
  formatClock,
  isInSkipAheadWindow,
  skipAheadWindow,
  nextUpCountdown,
  resumePosition,
  chooseVersion,
  pickTrack,
  playbackChoices,
  rememberPlayback,
  usesPlaybackChoices,
  tvPlaybackAttempts,
  type EpgListing,
  type LiveChannel,
  type PlaybackInfoWithAlternates,
  type PlayTarget,
  type SeekDirection,
  type VariantInfo,
  t,
  isOnWatchlist,
  isFoundSubtitle,
  recentChannelTarget,
  type RecentChannel,
  providerUnreachableMessage,
  unreachableHost,
  checkConnectionLimit,
  connectionCheckNeeded,
  connectionLimitMessage,
  holdStreamConnection,
  type ConnectionUse,
  isLiveStream,
} from '@iptv/shared';
import { TvMedia, TvPlayerView, type PlayerSource, type PlayerTrack, type TvPlayerViewRef } from '../../modules/tv-media';
import { api, appContext, downloadsStore, navStore, playbackSettings, stores } from '../appContext';
import { providerUserAgent } from '../config';
import { ErrorText, Loading } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { selectDownload } from '../downloads/downloadsStore';
import { useLibrary, useNoteRecentChannel, usePlayerTitle, useSession } from '../hooks';
import { toggleOnMyList } from '../tv/colourKeys';
import { useRemote } from '../tv/remote';
import { Gradient } from '../components/Gradient';
import { IconButton } from '../components/IconButton';
import { colors, useSizes } from '../theme';
import { savePlaybackProgress } from '@iptv/shared';
import { GuideOverlay } from './GuideOverlay';
import { RecentChannelsOverlay } from './RecentChannelsOverlay';
import { QuickDrawer, type DrawerTab } from './QuickDrawer';
import { NextUp } from './NextUp';
import { SkipAhead } from './SkipAhead';
import { PlayerHeader } from './PlayerHeader';
import { PlayerControls } from './PlayerControls';
import { TimelineRail } from './TimelineRail';
import type { TrackOption } from '@iptv/screens';
import { ScrubBar, TapFlash } from './SeekOverlay';
import { useFramePreview, type PreviewFrame } from './framePreview';
import { LevelBar, usePlayerSwipes } from './TouchLevels';
import { FocusRow } from '../components/FocusRow';

const PROGRESS_SAVE_MS = 10_000;

/**
 * Error text for the last failed attempt. HTTP 401/403 from the stream server means the provider refused this stream
 * although the login works: usually the account's connection limit, or the provider blocking the stream for a while.
 */
export function playbackErrorText(message: string, detail?: string | null, code = '', ffmpegAudio = false): string {
  if (code === 'OFFLINE_MISSING') return t('Download not found on this device.');
  const text = detail ? `${message} (${detail})` : message;
  const all = `${message} ${detail ?? ''}`;
  if (/HTTP 40[13]\b/.test(all))
    return `${t("Your IPTV provider refused this stream. Another device or app may be using the account's connections, or the provider is blocking streams for now. Try again later, or open it in another player.")} (${detail ?? message})`;
  if (code.startsWith('ERROR_CODE_DECODING') || code.startsWith('ERROR_CODE_AUDIO_TRACK')) {
    const audio = /MediaCodecAudioRenderer/.test(all);
    const mime = /\b(audio|video)\/([\w.-]+)/.exec(all.replace(/video\/x-matroska/g, ''))?.[2];
    const format = mime ? (CODEC_NAMES[mime] ?? mime.toUpperCase()) : null;
    const tip =
      audio && ffmpegAudio
        ? t('Try Playback → FFmpeg first in the account menu, another version, or another player such as VLC.')
        : t('Try another version, or open it in another player such as VLC, which brings its own decoders.');
    const problem = audio
      ? format
        ? t('This device could not decode the audio of this title ({format}).', { format })
        : t('This device could not decode the audio of this title.')
      : format
        ? t('This device could not decode the video of this title ({format}).', { format })
        : t('This device could not decode the video of this title.');
    return `${problem} ${tip}`;
  }
  // The provider's server stopped answering (it timed out or refused the connection): their side, not ours (D-074).
  if (code.startsWith('ERROR_CODE_IO_NETWORK')) return providerUnreachableMessage(unreachableHost(all));
  if (code.startsWith('ERROR_CODE_PARSING'))
    return t(
      'The provider did not send a playable video for this title (it may be broken on their side). Try another version, or open it in another player.',
    );
  return text;
}

const CODEC_NAMES: Record<string, string> = {
  eac3: 'Dolby Digital Plus',
  'eac3-joc': 'Dolby Atmos',
  ac3: 'Dolby Digital',
  'vnd.dts': 'DTS',
  'vnd.dts.hd': 'DTS-HD',
  'true-hd': 'Dolby TrueHD',
  hevc: 'HEVC',
  av01: 'AV1',
};
const CONTROLS_HIDE_MS = 4000;
/** TV: with the focus on the buttons, they stay a little longer after the last key. */
const BUTTONS_HIDE_MS = 8000;
/** TV, progress bar focused: a held ←/→ skips again this often (each press of the series skips further, D-128). */
const BAR_REPEAT_MS = 300;
/** Two taps on the left/right third within this time seek ∓10 s (phones). */
const DOUBLE_TAP_MS = 300;
/** How long a notice (e.g. the subtitle OpenSubtitles added, D-111) stays up. */
const NOTICE_MS = 4000;
/** The remote's media keys, as react-native-tvos names them. */
const MEDIA_KEYS = new Set(['playPause', 'play', 'pause', 'stop', 'rewind', 'fastForward']);

/**
 * Full-screen player. Remote: tap ←/→ ±10 s, hold ←/→ scrub, ↓ the on-screen buttons on Play/Pause (D-077), ↑ the same
 * buttons on Back (D-077), Select play/pause, Back close. Live: ↑ opens the guide overlay (phones: swipe up in the
 * middle or the Guide button). Phones: slides on the left/right third set brightness/volume (D-046). See
 * DECISIONS.md#d-028, #d-058.
 */
export function PlayerScreen({ target }: { target: PlayTarget }) {
  const playerRef = useRef<TvPlayerViewRef>(null);
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Same stream on the provider's other server, tried before the next attempt (D-088).
  const alternates = useRef<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The failure was the network (the provider's server stopped answering): the error offers Try again (D-074).
  const [retryable, setRetryable] = useState(false);
  // Bumped by Try again: the attempts start over.
  const [retry, setRetry] = useState(0);
  // Where the stream stopped (seconds), so a retry carries on from there instead of where the title was opened (D-074).
  const resumeAt = useRef<number | null>(null);
  // Mid-stream: the player waits for data (spinner), or a new address is being tried after the stream stopped.
  const [buffering, setBuffering] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<PlayerTrack[]>([]);
  const [controls, setControls] = useState(true);
  // Open drawer and the tab it opened on; false = closed.
  const [drawer, setDrawer] = useState<DrawerTab | false>(false);
  const [guide, setGuide] = useState(false);
  // Live TV, ↓: the channels watched last (issue #122).
  const [recent, setRecent] = useState(false);
  // TV: ↓ puts the focus on the on-screen buttons (back, play/pause, from the beginning, previous episode, ±10 s, next
  // episode, episodes, audio and subtitles), which the D-pad then walks through; Back or a few seconds without keys
  // return to the video (D-077).
  const [buttons, setButtons] = useState<false | 'play' | 'back'>(false);
  const tvButtons = Platform.isTV && !!buttons;
  // TV: the progress bar above the buttons takes the focus too; ←/→ on it move the video (D-179).
  const [barFocused, setBarFocused] = useState(false);
  const onBar = tvButtons && barFocused;
  const barKey = useRef<{ key: string; at: number } | null>(null);
  useEffect(() => {
    if (!buttons) setBarFocused(false);
  }, [buttons]);
  const [flash, setFlash] = useState<{ direction: SeekDirection; key: number; seconds?: number } | null>(null);
  const [scrub, setScrub] = useState<{ preview: number; speed: number; step?: number; direction: SeekDirection } | null>(null);
  const [nextDismissed, setNextDismissed] = useState(false);
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  // A past programme from the provider's recordings plays like a video: seeking, no LIVE tag (issue #226).
  const isLive = isLiveStream(target);
  const sizes = useSizes();
  const { width } = useWindowDimensions();
  const timelineWidth = useRef(0);

  // The episode lists of all versions of the series, merged (D-066), and a movie's versions; shared (D-079).
  const { series, next, previous, variants } = usePlayerTitle(target);
  // Live: Home's first row and the ↓ strip list the channels watched last (issue #122).
  useNoteRecentChannel(target);

  // The profile's subtitles and audio track (D-087): selected once per source, when its tracks are known; a pick in
  // the drawer becomes the choice every movie and series starts with.
  const tracksApplied = useRef<{ source: PlayerSource | null; text: boolean; audio: boolean }>({ source: null, text: false, audio: false });
  const onTracks = (list: PlayerTrack[]) => {
    setTracks(list);
    if (!source || !usesPlaybackChoices(target)) return;
    if (tracksApplied.current.source !== source) tracksApplied.current = { source, text: false, audio: false };
    const applied = tracksApplied.current;
    const choices = playbackChoices(stores);
    for (const [type, choice] of [
      ['text', choices.subtitles],
      ['audio', choices.audio],
    ] as const) {
      const options = list.filter((track) => track.type === type);
      if (applied[type] || options.length === 0) continue;
      applied[type] = true;
      const pick = pickTrack(options, choice);
      if (pick === null || pick === options.findIndex((track) => track.selected)) continue;
      const track = options[pick];
      if (track) void playerRef.current?.selectTrack(type, track.groupIndex, track.trackIndex);
      else void playerRef.current?.selectTrack(type, -1, 0);
    }
  };
  // OpenSubtitles (D-111): once per streamed source, when it plays and its own tracks are known; the stream's own
  // subtitle in a preferred language wins. A short notice says what happened.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const movieYear = useLibrary((s) =>
    target.kind === 'movie' && target.masterId ? s.details[`movies|${target.masterId}`]?.data?.year : null,
  );
  const subtitleFor = useRef<PlayerSource | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !source?.uri || subtitleFor.current === source) return;
    subtitleFor.current = source;
    let cancelled = false;
    const trackLanguages = tracksRef.current.filter((track) => track.type === 'text').map((track) => track.language);
    void appContext.subtitles.find(target, { trackLanguages, year: movieYear ?? null }).then(async (found) => {
      if (cancelled) return;
      if (!isFoundSubtitle(found)) {
        if (found.message) setNotice(found.message);
        return;
      }
      const added = await playerRef.current?.addSubtitle(found.srt, found.language, found.label);
      if (!cancelled && added) setNotice(t('Subtitles: {label}', { label: found.label }));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, source, target, movieYear]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // The drawer's options: audio named so versions of one language tell apart, subtitles by language (D-087).
  const audioTracks = tracks.filter((track) => track.type === 'audio');
  const audioNames = audioTrackLabels(audioTracks);
  const optionOf = (track: PlayerTrack, label: string): TrackOption => ({
    key: `${track.groupIndex}-${track.trackIndex}`,
    label,
    selected: track.selected,
    pick: () => chooseTrack(track.type === 'audio' ? 'audio' : 'text', track.groupIndex, track.trackIndex),
  });
  const audioOptions = audioTracks.map((track, index) => optionOf(track, audioNames[index] ?? trackLabel(track)));
  const subtitleOptions = tracks.filter((track) => track.type === 'text').map((track) => optionOf(track, trackLabel(track)));
  const chooseTrack = (type: 'audio' | 'text', groupIndex: number, trackIndex: number) => {
    void playerRef.current?.selectTrack(type, groupIndex, trackIndex);
    if (!usesPlaybackChoices(target)) return;
    const chosen = tracks.find((track) => track.type === type && track.groupIndex === groupIndex && track.trackIndex === trackIndex);
    const choice = chosen ? { language: chosen.language, label: chosen.label } : null;
    if (type === 'text') rememberPlayback(stores, { subtitles: choice ?? { off: true } });
    else if (choice) rememberPlayback(stores, { audio: choice });
  };

  // Another title (next episode, another channel or version): it starts where its own target says.
  useEffect(() => {
    resumeAt.current = null;
  }, [target]);

  // All the account's streams in use (issue #242, D-175): asks before opening another. 'checking' while the provider
  // answers; skipped for a download and while the provider still counts the app's own stream (zapping, next episode).
  const [limit, setLimit] = useState<ConnectionUse | 'checking' | null>(() => {
    const download = target.kind === 'live' ? null : selectDownload(downloadsStore.getState(), target.kind, target.streamId);
    return download?.state !== 'completed' && api.playback.connections && connectionCheckNeeded() ? 'checking' : null;
  });
  useEffect(() => {
    if (limit !== 'checking' || !api.playback.connections) return;
    let cancelled = false;
    const read = api.playback.connections;
    void checkConnectionLimit((signal) => read(signal)).then((use) => {
      if (cancelled) return;
      if (use) appLog.warn('player', `${use.active} of ${use.max} connections in use: asking before playing`);
      setLimit(use);
    });
    return () => {
      cancelled = true;
    };
  }, [limit]);
  const waiting = limit !== null;
  const full = limit !== null && limit !== 'checking' ? limit : null;
  // Error and the full account stop the player alike: no controls, swipes or focus catcher behind them.
  const halted = !!error || !!full;
  useEffect(() => (source && !source.offlineId ? holdStreamConnection() : undefined), [source]);

  // Resolve the source: completed download first, else the TV attempt list (original file, then HLS).
  useEffect(() => {
    if (waiting) return;
    let cancelled = false;
    // Read when the title starts: a changed setting applies to the next title, not mid-stream (D-059).
    const audioDecoder = playbackSettings.getState().audioDecoder;
    const saved = target.kind === 'live' ? null : findProgress(stores.progress.getState(), target.kind, target.streamId);
    const startPositionMs = (resumeAt.current ?? target.startAt ?? resumePosition(saved)) * 1000;
    const download = target.kind === 'live' ? null : selectDownload(downloadsStore.getState(), target.kind, target.streamId);
    const session = stores.session.getState();
    const access = offlineAccess(session.account, session.lastOnlineAt);
    // A blocked download is skipped: online it streams instead; offline there is nothing else to play (D-050).
    if (download?.state === 'completed' && !access.allowed && session.offline) {
      setError(access.message);
      return;
    }
    const useDownload = download?.state === 'completed' && access.allowed;
    if (useDownload && attempt === 0) {
      setSource({ offlineId: download.id, startPositionMs, audioDecoder });
      return;
    }
    const plan = tvPlaybackAttempts(target.kind, target.container);
    const step = plan[useDownload ? attempt - 1 : attempt];
    if (!step) {
      appLog.error('player', `no playable source left for ${target.kind} ${target.streamId}`);
      setError(t('This stream could not be played. The provider may be offline.'));
      return;
    }
    alternates.current = [];
    api.playback.get(target.kind, target.streamId, step.container, undefined, { catchup: target.catchup }).then(
      (info: PlaybackInfoWithAlternates) => {
        if (cancelled) return;
        alternates.current = [...(info.alternateUrls ?? [])];
        appLog.info('player', `attempt ${attempt + 1}: ${step.engine} ${info.url} (${info.deliveryMode}, User-Agent ${providerUserAgent})`);
        setSource({ uri: info.url, isHls: step.engine === 'hls', startPositionMs, audioDecoder });
      },
      (error) => {
        if (cancelled) return;
        appLog.warn('player', `attempt ${attempt + 1}: no URL for ${step.container}: ${errorMessage(error)}`);
        setAttempt((a) => a + 1);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [target, attempt, retry, waiting]);

  const saveProgress = useCallback(() => savePlaybackProgress(stores.progress, target, timeRef.current, durationRef.current), [target]);

  useEffect(() => {
    if (paused || isLive) return;
    const timer = setInterval(saveProgress, PROGRESS_SAVE_MS);
    return () => clearInterval(timer);
  }, [paused, isLive, saveProgress]);
  useEffect(() => () => saveProgress(), [saveProgress]);

  const seekTo = useCallback((seconds: number) => {
    const clamped = clampTime(seconds, durationRef.current);
    timeRef.current = clamped;
    setTime(clamped);
    void playerRef.current?.seekTo(clamped * 1000);
  }, []);

  const controller = useRef<RemoteSeekController | null>(null);
  controller.current ??= new RemoteSeekController({
    getTime: () => timeRef.current,
    getDuration: () => durationRef.current,
    onTap: (direction, targetTime) => {
      seekTo(targetTime);
      setFlash({ direction, key: Date.now() });
    },
    onScrub: (preview, speed, direction, step) => setScrub({ preview, speed, step, direction }),
    onScrubEnd: (finalTime) => {
      setScrub(null);
      seekTo(finalTime);
    },
  });
  useEffect(() => () => controller.current?.cancel(), []);

  // The ±10 s buttons and double taps: presses in a row skip 10 s, 30 s, 1 min, 2 min, then 5 min (D-128).
  const skipStreak = useRef(new SkipStreak()).current;
  const skipPress = useCallback(
    (direction: SeekDirection) => {
      const seconds = skipStreak.press(direction);
      seekTo(timeRef.current + (direction === 'forward' ? seconds : -seconds));
      setFlash({ direction, key: Date.now(), seconds });
    },
    [skipStreak, seekTo],
  );

  // Progress bar preview frames (D-180): decoded from the stream over a second connection, so only where the account has
  // one to spare; not for downloads (encrypted), HLS or live.
  const maxConnections = useSession((s) => s.account?.maxConnections ?? null);
  const previewUri = source?.uri && !source.offlineId && !source.isHls && !isLive && spareConnection(maxConnections) ? source.uri : null;
  const preview = useFramePreview(previewUri);
  // TV, progress bar: ←/→ move this preview position; the video jumps there TAP_CHAIN_MS after the last press, on Select
  // or when the bar loses the focus (D-180).
  const [barPreview, setBarPreview] = useState<number | null>(null);
  const barPreviewRef = useRef<number | null>(null);
  const barJump = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPreview = preview.stop;
  const commitBar = useCallback(() => {
    if (barJump.current) clearTimeout(barJump.current);
    barJump.current = null;
    const position = barPreviewRef.current;
    barPreviewRef.current = null;
    setBarPreview(null);
    stopPreview();
    if (position !== null) seekTo(position);
  }, [seekTo, stopPreview]);
  const moveBar = (direction: SeekDirection) => {
    const seconds = skipStreak.press(direction);
    const from = barPreviewRef.current ?? timeRef.current;
    const position = clampTime(from + (direction === 'forward' ? seconds : -seconds), durationRef.current);
    barPreviewRef.current = position;
    setBarPreview(position);
    preview.request(position);
    if (barJump.current) clearTimeout(barJump.current);
    barJump.current = setTimeout(commitBar, TAP_CHAIN_MS);
  };
  useEffect(
    () => () => {
      if (barJump.current) clearTimeout(barJump.current);
    },
    [],
  );

  // Controls stay up while loading or paused; they hide CONTROLS_HIDE_MS after the last key once playing.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playing = ready && !paused;
  const wake = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = playing
      ? setTimeout(
          () => {
            setControls(false);
            setButtons(false);
          },
          buttons ? BUTTONS_HIDE_MS : CONTROLS_HIDE_MS,
        )
      : null;
  }, [playing, buttons]);
  useEffect(() => {
    wake();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [wake]);

  // Phones: the player turns to landscape; the rest of the app follows the device again on close.
  useEffect(() => {
    if (Platform.isTV) return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => void ScreenOrientation.unlockAsync().catch(() => undefined);
  }, []);

  // Phones: a tap shows or hides the controls; a second tap on the left/right third seeks ∓10 s instead, and further
  // quick taps there skip further (D-128).
  const lastTap = useRef<{ at: number; side: SeekDirection | null; controls: boolean } | null>(null);
  /**
   * Logs what the provider sent instead of a video (the first bytes, credentials masked). After the last attempt a
   * recognisable answer ("max connections", "not found", …) replaces the general error text (D-074).
   */
  const explainFailure = (uri: string, attemptNo: number, final: boolean) => {
    void probeStream(uri, { userAgent: providerUserAgent }).then((probe) => {
      appLog.warn('player', `attempt ${attemptNo}: the provider answered ${describeProbe(probe)}`);
      const text = final ? probeMessage(probeHint(probe)) : null;
      if (text) setError(text);
    });
  };

  const onScreenTap = (event: GestureResponderEvent) => {
    if (Platform.isTV) return;
    const x = event.nativeEvent.locationX;
    const side: SeekDirection | null = isLive ? null : x < width / 3 ? 'back' : x > (width * 2) / 3 ? 'forward' : null;
    const previous = lastTap.current;
    const now = Date.now();
    if (side && previous && previous.side === side && now - previous.at < DOUBLE_TAP_MS) {
      // Keep the controls as they were before the first tap.
      setControls(previous.controls);
      skipPress(side);
      lastTap.current = { at: now, side, controls: previous.controls };
      return;
    }
    lastTap.current = { at: now, side, controls };
    if (controls) setControls(false);
    else wake();
  };

  // Phones: drag along the timeline to scrub; the video jumps on release.
  const [dragTime, setDragTime] = useState<number | null>(null);
  const timeAt = (x: number) =>
    timelineWidth.current > 0 ? clampTime((x / timelineWidth.current) * durationRef.current, durationRef.current) : 0;
  const dragRef = useRef<number | null>(null);
  const timelinePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        dragRef.current = timeAt(event.nativeEvent.locationX);
        setDragTime(dragRef.current);
        preview.request(dragRef.current);
      },
      onPanResponderMove: (_, gesture) => {
        dragRef.current = timeAt(gesture.moveX - timelineLeft.current);
        setDragTime(dragRef.current);
        preview.request(dragRef.current);
      },
      onPanResponderRelease: () => {
        if (dragRef.current !== null) seekTo(dragRef.current);
        dragRef.current = null;
        setDragTime(null);
        preview.stop();
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        setDragTime(null);
        preview.stop();
      },
    }),
  ).current;
  const timelineLeft = useRef(0);

  // Another episode of this series (next up, previous/next buttons, the episode drawer) replaces this player.
  const playEpisode = useCallback(
    (episode: NonNullable<typeof next>) => {
      saveProgress();
      navStore.getState().replaceTop({
        name: 'player',
        target: episodeTarget(
          { title: target.title, masterId: target.masterId, seriesId: episode.seriesId, posterUrl: target.posterUrl },
          episode,
        ),
      });
    },
    [target, saveProgress],
  );
  const playNext = useCallback(() => {
    if (next && target.seriesId) playEpisode(next);
  }, [next, target.seriesId, playEpisode]);

  // "Skip ahead": early in an episode; opens into 30 s … 3 min. Stays up while its options are open.
  const skipWindow = skipAheadWindow(target.kind, duration);
  const [skipOpen, setSkipOpen] = useState(false);
  const showSkipAhead = ready && !halted && (skipOpen || isInSkipAheadWindow(skipWindow, time));
  const countdown = nextDismissed ? null : nextUpCountdown(time, duration, !!next);
  const focusablesVisible = showSkipAhead || countdown !== null;

  useRemote(({ key, action }) => {
    // The remote's colour keys (D-154): Red puts the title on My List or takes it off, Green opens audio and subtitles,
    // Blue the guide over a live channel. Yellow (Search) leaves the player: ColourKeys handles it.
    if (key === 'red' || key === 'green' || key === 'blue') {
      if (action === 'up' || error) return;
      wake();
      if (key === 'red' && target.masterId && !isLive) {
        const section = target.kind === 'movie' ? 'movies' : 'series';
        const onList = isOnWatchlist(stores.watchlist.getState(), section, target.masterId);
        toggleOnMyList({ section, card: { id: target.masterId, title: target.title, year: null, posterUrl: target.posterUrl ?? null } });
        setNotice(onList ? t('Removed from My List') : t('Added to My List'));
      } else if (key === 'green') {
        setButtons(false);
        setGuide(false);
        setRecent(false);
        setDrawer('audio');
      } else if (key === 'blue' && isLive) {
        setButtons(false);
        setDrawer(false);
        setRecent(false);
        setGuide(true);
      }
      return;
    }
    // The remote's media keys work whatever is open: the buttons, a drawer, the guide, Skip ahead (issue #178).
    // react-native-tvos reports them on release only, like Select. ⏪/⏩ like ←/→: presses in a row go faster (#121).
    if (MEDIA_KEYS.has(key)) {
      if (key === 'stop') {
        if (action !== 'down') navStore.getState().back();
        return;
      }
      if (error) return;
      wake();
      if (key === 'rewind' || key === 'fastForward') {
        if (action === 'up' || isLive) return;
        const direction: SeekDirection = key === 'rewind' ? 'back' : 'forward';
        controller.current!.keyDown(direction);
        controller.current!.keyUp(direction);
      } else if (action !== 'down') {
        if (key === 'playPause') setPaused((p) => !p);
        else setPaused(key === 'pause');
      }
      return;
    }
    if (drawer || guide || recent || error) return;
    wake();
    // The progress bar: ←/→ move a preview with a frame, further with each press in a row (D-128); a held key repeats
    // every BAR_REPEAT_MS. Up/Down leave it (native focus). See DECISIONS.md#d-179, #d-180.
    if (onBar && (key === 'left' || key === 'right')) {
      if (action === 'up') {
        barKey.current = null;
        return;
      }
      const now = Date.now();
      const held = barKey.current?.key === key;
      if (held && now - barKey.current!.at < BAR_REPEAT_MS) return;
      barKey.current = { key, at: now };
      moveBar(key === 'left' ? 'back' : 'forward');
      return;
    }
    // On the buttons the D-pad moves the focus and Select presses the focused button.
    if (tvButtons) return;
    // A row of buttons on screen (Skip ahead's 30 s … 3 min, next-up's Play Now / Cancel): ←/→ move between them and
    // must not also seek ±10 s. The single Skip ahead button leaves ←/→ seeking.
    if ((key === 'left' || key === 'right') && Platform.isTV && (skipOpen || countdown !== null)) return;
    if ((key === 'left' || key === 'right') && !isLive) {
      const direction: SeekDirection = key === 'left' ? 'back' : 'forward';
      if (action === 'down') controller.current!.keyDown(direction);
      else if (action === 'up') controller.current!.keyUp(direction);
      else {
        controller.current!.keyDown(direction);
        controller.current!.keyUp(direction);
      }
      return;
    }
    // react-native-tvos reports select on release only (like a click); other keys on press.
    if (key === 'select') {
      if (action !== 'down' && !focusablesVisible) setPaused((p) => !p);
      return;
    }
    if (action === 'up') return;
    // TV: ↓ opens the buttons on Play/Pause, ↑ on Back at the top left (D-077); on Live TV ↑ opens the guide and ↓ the
    // channels watched last, with the buttons one more ↓ away (issue #122).
    if (key === 'down' && Platform.isTV && isLive) setRecent(true);
    else if (key === 'down' && Platform.isTV) setButtons('play');
    else if (key === 'up' && isLive) setGuide(true);
    else if (key === 'up' && Platform.isTV) setButtons('back');
    else if (key === 'up' || key === 'down') setDrawer('audio');
  });

  // Back: close the drawer or the skip options first (registered after the shell's handler, so it runs first).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (guide) setGuide(false);
      else if (recent) setRecent(false);
      else if (drawer) setDrawer(false);
      else if (skipOpen) setSkipOpen(false);
      else if (buttons) setButtons(false);
      else return false;
      return true;
    });
    return () => subscription.remove();
  }, [guide, recent, drawer, skipOpen, buttons]);

  // Phones: slide up/down on the left third for brightness, the right third for volume; live: swipe up in the middle
  // opens the guide overlay (D-046).
  const swipe = usePlayerSwipes(!Platform.isTV && !guide && !drawer && !recent && !halted, isLive ? () => setGuide(true) : null);

  const zap = (channel: LiveChannel, programme: EpgListing | null) => {
    setGuide(false);
    if (channel.id === target.streamId) return;
    navStore.getState().replaceTop({ name: 'player', target: liveTarget(channel, programme?.title) });
  };

  const zapRecent = (channel: RecentChannel) => {
    setRecent(false);
    if (channel.id === target.streamId) return;
    navStore.getState().replaceTop({ name: 'player', target: recentChannelTarget(channel) });
  };

  const switchVariant = (variant: VariantInfo) => {
    saveProgress();
    chooseVersion(stores, target.masterId!, variant);
    navStore.getState().replaceTop({
      name: 'player',
      target: {
        ...target,
        streamId: variant.streamId,
        container: variant.containerExtension,
        subtitle: variant.label,
        startAt: timeRef.current,
      },
    });
  };

  // After the provider's server stopped answering: all attempts again, from where the stream stopped (D-074).
  const tryAgain = () => {
    if (!isLive && timeRef.current > 0) resumeAt.current = timeRef.current;
    appLog.info('player', `trying again${resumeAt.current ? ` from ${formatClock(resumeAt.current)}` : ''}`);
    setError(null);
    setRetryable(false);
    setReady(false);
    // A new source even when the address is the same, so the player reconnects.
    setSource(null);
    setAttempt(0);
    setRetry((r) => r + 1);
  };

  const percent = duration > 0 ? ((dragTime ?? barPreview ?? time) / duration) * 100 : 0;

  return (
    <View style={styles.screen} testID="player-screen" {...swipe.panHandlers}>
      <TvPlayerView
        ref={playerRef}
        style={StyleSheet.absoluteFill}
        source={source}
        paused={paused}
        onStatus={(e) => {
          const playing = e.nativeEvent.state === 'ready' || e.nativeEvent.isPlaying;
          setReady(playing || ready);
          setBuffering(e.nativeEvent.state === 'buffering');
          if (playing) setReconnecting(false);
          // Headphones gone: the player paused itself; show it paused so Play resumes (#83).
          if (e.nativeEvent.pausedByAudioOutput) setPaused(true);
        }}
        onProgress={(e) => {
          if (scrub) return;
          timeRef.current = e.nativeEvent.positionMs / 1000;
          durationRef.current = e.nativeEvent.durationMs / 1000;
          setTime(timeRef.current);
          setDuration(durationRef.current);
        }}
        onTracks={(e) => onTracks(e.nativeEvent.tracks)}
        onEnd={() => {
          saveProgress();
          if (next && !nextDismissed) playNext();
        }}
        onError={(e) => {
          const { message, code, detail } = e.nativeEvent;
          appLog.error('player', `attempt ${attempt + 1} failed: ${code} ${message}${detail ? ` (${detail})` : ''}`);
          // It had been playing: the next try carries on from here, with a spinner that says what is going on (D-074).
          const stopped = ready && !isLive && timeRef.current > 0;
          if (stopped) resumeAt.current = timeRef.current;
          // "Not a video" or an HTTP error: log what the provider actually sent (D-074).
          const explain = !source?.offlineId && /^ERROR_CODE_(PARSING|IO_BAD_HTTP_STATUS)/.test(code) ? source?.uri : undefined;
          // Decoding errors: the other server and the HLS copy carry the same audio/video, so retrying only costs time.
          if (code.startsWith('ERROR_CODE_DECODING') || code.startsWith('ERROR_CODE_AUDIO_TRACK')) {
            // The device's audio decoder claimed the format and failed (issue #235): FFmpeg takes over, for this title
            // and, as the saved choice, on this device from now on (D-059).
            const audioFailed = /MediaCodecAudioRenderer/.test(`${message} ${detail ?? ''}`);
            if (source && audioFailed && source.audioDecoder !== 'ffmpeg' && TvMedia.ffmpegAudioAvailable()) {
              appLog.warn('player', 'the device could not decode the audio: trying FFmpeg, kept for later titles');
              void playbackSettings.getState().setAudioDecoder('ffmpeg');
              setReady(false);
              setSource({
                ...source,
                audioDecoder: 'ffmpeg',
                startPositionMs: resumeAt.current !== null ? resumeAt.current * 1000 : source.startPositionMs,
              });
              return;
            }
            setError(playbackErrorText(message, detail, code, TvMedia.ffmpegAudioAvailable() && source?.audioDecoder !== 'ffmpeg'));
            return;
          }
          // The stream server's other address only helps with network and HTTP errors.
          const alternate = source?.offlineId || !code.startsWith('ERROR_CODE_IO') ? undefined : alternates.current.shift();
          if (alternate) {
            if (explain) explainFailure(explain, attempt + 1, false);
            appLog.info('player', `attempt ${attempt + 1}: retrying on the stream server ${alternate}`);
            setReady(false);
            if (stopped) setReconnecting(true);
            setSource({
              ...source,
              uri: alternate,
              startPositionMs: resumeAt.current !== null ? resumeAt.current * 1000 : source?.startPositionMs,
            });
            return;
          }
          // A failed stream (not a download) moves on to the next attempt.
          const final = !(!source?.offlineId && attempt < tvPlaybackAttempts(target.kind, target.container).length - 1);
          if (explain) explainFailure(explain, attempt + 1, final);
          if (!final) {
            setReady(false);
            if (stopped) setReconnecting(true);
            setAttempt((a) => a + 1);
          } else {
            setReconnecting(false);
            setRetryable(!source?.offlineId && code.startsWith('ERROR_CODE_IO'));
            setError(playbackErrorText(message, detail, code, TvMedia.ffmpegAudioAvailable()));
          }
        }}
      />

      {/* Android TV sends D-pad keys to JS only while a view has focus; nothing else is focusable here. See DECISIONS.md#d-028.
          On TV it steps aside while Skip ahead / Next episode buttons need the focus; phones keep it, so a tap on the video
          still shows the controls and the timeline while those buttons are up. */}
      {!drawer && !guide && !recent && !(Platform.isTV && focusablesVisible) && !tvButtons && !halted ? (
        <Pressable
          testID="player-focus"
          accessibilityLabel={t('Player')}
          hasTVPreferredFocus
          style={StyleSheet.absoluteFill}
          onPress={onScreenTap}
        />
      ) : null}

      {(!ready || buffering) && !halted ? <Loading label={t('Loading stream')} /> : null}
      {/* Mid-stream the provider stopped sending the video: says so while the next address is tried (D-074). */}
      {(notice || reconnecting) && !halted ? (
        <View style={styles.notice} pointerEvents="none" testID="player-notice">
          <Text style={styles.noticeText}>{reconnecting ? t('The provider stopped sending the video. Reconnecting…') : notice}</Text>
        </View>
      ) : null}
      {full && !error ? (
        <View style={styles.center} testID="player-connection-limit">
          <ErrorText>{connectionLimitMessage(full)}</ErrorText>
          <FocusButton
            label={t('Play anyway')}
            variant="primary"
            hasTVPreferredFocus
            testID="player-play-anyway"
            onPress={() => setLimit(null)}
          />
          <FocusButton label={t('Go back')} onPress={() => navStore.getState().back()} />
        </View>
      ) : null}
      {error ? (
        <View style={styles.center}>
          <ErrorText>{error}</ErrorText>
          {retryable ? (
            <FocusButton label={t('Try again')} variant="primary" hasTVPreferredFocus testID="player-retry" onPress={tryAgain} />
          ) : null}
          <FocusButton
            label={t('Go back')}
            variant={retryable ? undefined : 'primary'}
            hasTVPreferredFocus={!retryable}
            onPress={() => navStore.getState().back()}
          />
        </View>
      ) : null}

      {/* Phones: both bars stay up with the controls, so the sides that slide are always shown; otherwise only while
          sliding (D-046). */}
      {!Platform.isTV && controls && !guide && !recent && !drawer && !scrub && !halted ? (
        <>
          <LevelBar kind="brightness" value={swipe.level?.kind === 'brightness' ? swipe.level.value : TvMedia.brightness()} />
          <LevelBar kind="volume" value={swipe.level?.kind === 'volume' ? swipe.level.value : TvMedia.volume()} />
        </>
      ) : swipe.level && !halted ? (
        <LevelBar kind={swipe.level.kind} value={swipe.level.value} />
      ) : null}
      {flash ? <TapFlash direction={flash.direction} seconds={flash.seconds} flashKey={flash.key} onDone={() => setFlash(null)} /> : null}
      {scrub ? (
        <ScrubBar preview={scrub.preview} speed={scrub.speed} step={scrub.step} direction={scrub.direction} duration={duration} />
      ) : null}

      {controls && !guide && !recent && !scrub && !halted ? (
        // Web `.player__overlay`: back + title on top, timeline + controls at the bottom. On TV the remote drives them.
        <View style={styles.overlay} pointerEvents={Platform.isTV && !buttons ? 'none' : 'box-none'} testID="player-controls">
          <Gradient
            stops={[
              { offset: 0, color: '#000', opacity: 0.7 },
              { offset: 0.2, color: '#000', opacity: 0 },
              { offset: 0.7, color: '#000', opacity: 0 },
              { offset: 1, color: '#000', opacity: 0.85 },
            ]}
          />
          {/* Phones: a big play/pause in the middle, like Netflix and YouTube; same as the one at the bottom left. */}
          {!Platform.isTV && ready && !buffering && !drawer ? (
            <View style={styles.middle} pointerEvents="box-none">
              <IconButton
                icon={paused ? 'play' : 'pause'}
                label={paused ? t('Play') : t('Pause')}
                size={72}
                iconSize={40}
                testID="player-center-toggle"
                onPress={() => setPaused((p) => !p)}
              />
            </View>
          ) : null}
          <PlayerHeader
            title={target.title}
            subtitle={target.subtitle}
            downloaded={!!source?.offlineId}
            live={isLive}
            onBack={() => navStore.getState().back()}
            backFocusable={!Platform.isTV || !!buttons}
            backPreferredFocus={tvButtons && buttons === 'back'}
          />
          <View style={[styles.bottom, { paddingHorizontal: sizes.gutter }]}>
            {isLive ? null : Platform.isTV ? (
              // TV: one more row above the buttons; Left/Right stay on it and move the video (D-179).
              <FocusRow>
                <Pressable
                  style={styles.timeline}
                  accessibilityLabel={t('Seek')}
                  testID="player-timeline"
                  focusable={tvButtons}
                  onFocus={() => setBarFocused(true)}
                  onBlur={() => {
                    setBarFocused(false);
                    commitBar();
                  }}
                  onPress={() => (barPreviewRef.current !== null ? commitBar() : setPaused((p) => !p))}
                  onLayout={(event) => (timelineWidth.current = event.nativeEvent.layout.width)}
                >
                  <TimelineRail
                    played={percent / 100}
                    state={onBar ? 'focused' : 'idle'}
                    label={onBar ? formatClock(barPreview ?? time) : null}
                    frame={barPreview !== null ? frameImage(preview.frame) : null}
                    frameWidth={288}
                  />
                </Pressable>
              </FocusRow>
            ) : (
              <View
                style={styles.timeline}
                accessibilityLabel={t('Seek')}
                testID="player-timeline"
                {...timelinePan.panHandlers}
                onLayout={(event) => {
                  timelineWidth.current = event.nativeEvent.layout.width;
                  event.currentTarget.measure((_x, _y, _w, _h, pageX) => (timelineLeft.current = pageX));
                }}
              >
                <TimelineRail
                  played={percent / 100}
                  state={dragTime !== null ? 'dragging' : 'idle'}
                  label={dragTime !== null ? formatClock(dragTime) : null}
                  frame={dragTime !== null ? frameImage(preview.frame) : null}
                  frameWidth={160}
                />
              </View>
            )}
            <PlayerControls
              playing={!paused}
              live={isLive}
              time={time}
              duration={duration}
              previous={previous}
              next={next}
              episodes={!!series}
              onTogglePlay={() => setPaused((p) => !p)}
              onRestart={() => seekTo(0)}
              onSkip={skipPress}
              onEpisode={playEpisode}
              onGuide={() => {
                setButtons(false);
                setGuide(true);
              }}
              onAudio={() => {
                setButtons(false);
                setDrawer('audio');
              }}
              onSubtitles={() => {
                setButtons(false);
                setDrawer('subtitles');
              }}
              onEpisodes={() => {
                setButtons(false);
                setDrawer('episodes');
              }}
              focusable={!Platform.isTV || !!buttons}
              preferredFocus={tvButtons && buttons === 'play' ? 'play' : null}
            />
          </View>
        </View>
      ) : null}

      {showSkipAhead ? (
        <SkipAhead
          open={skipOpen}
          onToggle={() => setSkipOpen((open) => !open)}
          onSkip={(seconds) => {
            setSkipOpen(false);
            seekTo(timeRef.current + seconds);
            // Show where it landed.
            wake();
          }}
        />
      ) : null}

      {countdown !== null && next ? (
        <NextUp
          episode={next}
          secondsLeft={Math.min(countdown, NEXT_UP_COUNTDOWN_SECONDS)}
          onPlayNow={playNext}
          onDismiss={() => setNextDismissed(true)}
        />
      ) : null}

      {guide ? (
        <GuideOverlay channelId={target.streamId} categoryId={target.categoryId ?? null} onSelect={zap} onClose={() => setGuide(false)} />
      ) : null}

      {recent ? (
        <RecentChannelsOverlay
          channelId={target.streamId}
          onSelect={zapRecent}
          onMore={() => {
            setRecent(false);
            setButtons('play');
            wake();
          }}
          onClose={() => setRecent(false)}
        />
      ) : null}

      {drawer ? (
        <QuickDrawer
          initialTab={drawer}
          onClose={() => setDrawer(false)}
          audio={audioOptions}
          subtitles={subtitleOptions}
          subtitlesOff={() => chooseTrack('text', -1, 0)}
          variants={variants}
          currentStreamId={target.streamId}
          series={series}
          onVariant={(v) => {
            setDrawer(false);
            switchVariant(v);
          }}
          onEpisode={(episode) => {
            setDrawer(false);
            playEpisode(episode);
          }}
        />
      ) : null}
    </View>
  );
}

/** The preview frame over the progress bar (D-180), or null while there is none. */
function frameImage(frame: PreviewFrame | null) {
  if (!frame) return null;
  return <Image source={{ uri: frame.image }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  middle: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  notice: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  noticeText: { color: colors.strong, fontSize: 16 },
  bottom: { paddingBottom: 20 },
  // Tall enough to grab with a finger; the rail is drawn in the middle.
  timeline: { height: 32, justifyContent: 'center' },
});
