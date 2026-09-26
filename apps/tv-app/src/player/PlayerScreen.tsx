import { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationBar } from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  BackHandler,
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
  errorMessage,
  NEXT_UP_COUNTDOWN_SECONDS,
  RemoteSeekController,
  SKIP_SECONDS,
  clampTime,
  fluid,
  episodeLabel,
  episodeTarget,
  findProgress,
  liveTarget,
  offlineAccess,
  formatClock,
  isInSkipAheadWindow,
  skipAheadDescription,
  skipAheadLabel,
  skipAheadWindow,
  SKIP_AHEAD_OPTIONS,
  nextEpisode,
  nextUpCountdown,
  resumePosition,
  tvPlaybackAttempts,
  type EpgListing,
  type LiveChannel,
  type PlaybackInfoWithAlternates,
  type PlayTarget,
  type SeekDirection,
  type VariantInfo,
} from '@iptv/shared';
import { TvPlayerView, type PlayerSource, type PlayerTrack, type TvPlayerViewRef } from '../../modules/tv-media';
import { api, downloadsStore, navStore, playbackSettings, stores } from '../appContext';
import { providerUserAgent } from '../config';
import { ErrorText, Loading } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { selectDownload } from '../downloads/downloadsStore';
import { useLibrary } from '../hooks';
import { useRemote } from '../tv/remote';
import { Gradient } from '../components/Gradient';
import { IconButton } from '../components/IconButton';
import { colors, fonts, useSizes } from '../theme';
import { useAsync } from '../useAsync';
import { GuideOverlay } from './GuideOverlay';
import { QuickDrawer } from './QuickDrawer';
import { ScrubBar, TapFlash } from './SeekOverlay';

const PROGRESS_SAVE_MS = 10_000;

/**
 * Error text for the last failed attempt. HTTP 401/403 from the stream server means the provider refused this stream
 * although the login works: usually the account's connection limit, or the provider blocking the stream for a while.
 */
export function playbackErrorText(message: string, detail?: string | null, code = ''): string {
  const text = detail ? `${message} (${detail})` : message;
  const all = `${message} ${detail ?? ''}`;
  if (/HTTP 40[13]\b/.test(all))
    return `Your IPTV provider refused this stream. Another device or app may be using the account's connections, or the provider is blocking streams for now. Try again later, or open it in another player. (${detail ?? message})`;
  if (code.startsWith('ERROR_CODE_DECODING') || code.startsWith('ERROR_CODE_AUDIO_TRACK')) {
    const audio = /MediaCodecAudioRenderer/.test(all);
    const mime = /\b(audio|video)\/([\w.-]+)/.exec(all.replace(/video\/x-matroska/g, ''))?.[2];
    const format = mime ? (CODEC_NAMES[mime] ?? mime.toUpperCase()) : null;
    return `This device could not decode the ${audio ? 'audio' : 'video'} of this title${format ? ` (${format})` : ''}. Try another version, or open it in another player such as VLC, which brings its own decoders.`;
  }
  if (code.startsWith('ERROR_CODE_PARSING'))
    return 'The provider did not send a playable video for this title (it may be broken on their side). Try another version, or open it in another player.';
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
/** Two taps on the left/right third within this time seek ∓10 s (phones). */
const DOUBLE_TAP_MS = 300;

/**
 * Full-screen player. Remote: tap ←/→ ±10 s, hold ←/→ scrub, ↑/↓ quick drawer, Select play/pause, Back close.
 * Live: ↑ opens the guide overlay (phones: swipe up or the Guide button), ↓ the drawer. See DECISIONS.md#d-028, #d-058.
 */
export function PlayerScreen({ target }: { target: PlayTarget }) {
  const playerRef = useRef<TvPlayerViewRef>(null);
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Same stream on the provider's other server, tried before the next attempt (D-038).
  const alternates = useRef<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<PlayerTrack[]>([]);
  const [controls, setControls] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [guide, setGuide] = useState(false);
  const [flash, setFlash] = useState<{ direction: SeekDirection; key: number } | null>(null);
  const [scrub, setScrub] = useState<{ preview: number; speed: number } | null>(null);
  const [nextDismissed, setNextDismissed] = useState(false);
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  const isLive = target.kind === 'live';
  const sizes = useSizes();
  const { width } = useWindowDimensions();
  const timelineWidth = useRef(0);

  const series = useAsync(target.seriesId ? `series:${target.seriesId}` : null, () => api.catalog.seriesDetails(target.seriesId!));
  const next = series.data && target.kind === 'episode' ? nextEpisode(series.data, target.streamId) : null;
  const variants = useLibrary((s) =>
    target.kind === 'movie' && target.masterId ? (s.details[`movies|${target.masterId}`]?.data?.variants ?? []) : [],
  );

  useEffect(() => {
    if (target.kind === 'movie' && target.masterId) void stores.library.getState().loadDetails('movies', target.masterId);
  }, [target.kind, target.masterId]);

  // Resolve the source: completed download first, else the TV attempt list (original file, then HLS).
  useEffect(() => {
    let cancelled = false;
    // Read when the title starts: a changed setting applies to the next title, not mid-stream (D-059).
    const audioDecoder = playbackSettings.getState().audioDecoder;
    const saved = target.kind === 'live' ? null : findProgress(stores.progress.getState(), target.kind, target.streamId);
    const startPositionMs = (target.startAt ?? resumePosition(saved)) * 1000;
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
      setError('This stream could not be played. The provider may be offline.');
      return;
    }
    alternates.current = [];
    api.playback.get(target.kind, target.streamId, step.container).then(
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
  }, [target, attempt]);

  const saveProgress = useCallback(() => {
    if (target.kind === 'live' || !(durationRef.current > 0)) return;
    void stores.progress.getState().save(target.kind, target.streamId, {
      title: target.title,
      positionSeconds: timeRef.current,
      durationSeconds: durationRef.current,
      masterId: target.masterId ?? null,
      seriesId: target.seriesId ?? null,
      seasonNumber: target.seasonNumber ?? null,
      episodeNumber: target.episodeNumber ?? null,
      posterUrl: target.posterUrl ?? null,
      containerExtension: target.container,
    });
  }, [target]);

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
    onScrub: (preview, speed) => setScrub({ preview, speed }),
    onScrubEnd: (finalTime) => {
      setScrub(null);
      seekTo(finalTime);
    },
  });
  useEffect(() => () => controller.current?.cancel(), []);

  // Controls stay up while loading or paused; they hide CONTROLS_HIDE_MS after the last key once playing.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playing = ready && !paused;
  const wake = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = playing ? setTimeout(() => setControls(false), CONTROLS_HIDE_MS) : null;
  }, [playing]);
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

  // Phones: a tap shows or hides the controls; a second tap on the left/right third seeks ∓10 s instead.
  const lastTap = useRef<{ at: number; side: SeekDirection | null; controls: boolean } | null>(null);
  const onScreenTap = (event: GestureResponderEvent) => {
    if (Platform.isTV) return;
    const x = event.nativeEvent.locationX;
    const side: SeekDirection | null = isLive ? null : x < width / 3 ? 'back' : x > (width * 2) / 3 ? 'forward' : null;
    const previous = lastTap.current;
    const now = Date.now();
    if (side && previous && previous.side === side && now - previous.at < DOUBLE_TAP_MS) {
      // Keep the controls as they were before the first tap.
      setControls(previous.controls);
      seekTo(timeRef.current + (side === 'forward' ? SKIP_SECONDS : -SKIP_SECONDS));
      setFlash({ direction: side, key: now });
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
      },
      onPanResponderMove: (_, gesture) => {
        dragRef.current = timeAt(gesture.moveX - timelineLeft.current);
        setDragTime(dragRef.current);
      },
      onPanResponderRelease: () => {
        if (dragRef.current !== null) seekTo(dragRef.current);
        dragRef.current = null;
        setDragTime(null);
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        setDragTime(null);
      },
    }),
  ).current;
  const timelineLeft = useRef(0);

  const playNext = useCallback(() => {
    if (!next || !target.seriesId) return;
    saveProgress();
    navStore.getState().replaceTop({
      name: 'player',
      target: episodeTarget(
        { title: target.title, masterId: target.masterId, seriesId: target.seriesId, posterUrl: target.posterUrl },
        next,
      ),
    });
  }, [next, target, saveProgress]);

  // "Skip ahead": early in an episode; opens into 30 s … 3 min. Stays up while its options are open.
  const skipWindow = skipAheadWindow(target.kind, duration);
  const [skipOpen, setSkipOpen] = useState(false);
  const showSkipAhead = ready && !error && (skipOpen || isInSkipAheadWindow(skipWindow, time));
  const countdown = nextDismissed ? null : nextUpCountdown(time, duration, !!next);
  const focusablesVisible = showSkipAhead || countdown !== null;

  useRemote(({ key, action }) => {
    if (drawer || guide || error) return;
    wake();
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
    // react-native-tvos reports select/playPause on release only (like a click); other keys on press.
    if (key === 'select' || key === 'playPause') {
      if (action !== 'down' && (key === 'playPause' || !focusablesVisible)) setPaused((p) => !p);
      return;
    }
    if (action === 'up') return;
    if (key === 'up' && isLive) setGuide(true);
    else if (key === 'up' || key === 'down') setDrawer(true);
    else if (key === 'rewind' && !isLive) seekTo(timeRef.current - SKIP_SECONDS);
    else if (key === 'fastForward' && !isLive) seekTo(timeRef.current + SKIP_SECONDS);
  });

  // Back: close the drawer or the skip options first (registered after the shell's handler, so it runs first).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (guide) setGuide(false);
      else if (drawer) setDrawer(false);
      else if (skipOpen) setSkipOpen(false);
      else return false;
      return true;
    });
    return () => subscription.remove();
  }, [guide, drawer, skipOpen]);

  // Phones, live: swipe up anywhere on the video opens the guide overlay.
  const swipeEnabled = useRef(false);
  swipeEnabled.current = isLive && !Platform.isTV && !guide && !drawer && !error;
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        swipeEnabled.current && gesture.dy < -40 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 2,
      onPanResponderGrant: () => setGuide(true),
    }),
  ).current;

  const zap = (channel: LiveChannel, programme: EpgListing | null) => {
    setGuide(false);
    if (channel.id === target.streamId) return;
    navStore.getState().replaceTop({ name: 'player', target: liveTarget(channel, programme?.title) });
  };

  const switchVariant = (variant: VariantInfo) => {
    saveProgress();
    stores.library.getState().selectVariant(target.masterId!, variant.streamId);
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

  const percent = duration > 0 ? ((dragTime ?? time) / duration) * 100 : 0;

  return (
    <View style={styles.screen} testID="player-screen" {...swipe.panHandlers}>
      <TvPlayerView
        ref={playerRef}
        style={StyleSheet.absoluteFill}
        source={source}
        paused={paused}
        onStatus={(e) => setReady(e.nativeEvent.state === 'ready' || e.nativeEvent.isPlaying || ready)}
        onProgress={(e) => {
          if (scrub) return;
          timeRef.current = e.nativeEvent.positionMs / 1000;
          durationRef.current = e.nativeEvent.durationMs / 1000;
          setTime(timeRef.current);
          setDuration(durationRef.current);
        }}
        onTracks={(e) => setTracks(e.nativeEvent.tracks)}
        onEnd={() => {
          saveProgress();
          if (next && !nextDismissed) playNext();
        }}
        onError={(e) => {
          const { message, code, detail } = e.nativeEvent;
          appLog.error('player', `attempt ${attempt + 1} failed: ${code} ${message}${detail ? ` (${detail})` : ''}`);
          // Decoding errors: the other server and the HLS copy carry the same audio/video, so retrying only costs time.
          if (code.startsWith('ERROR_CODE_DECODING') || code.startsWith('ERROR_CODE_AUDIO_TRACK')) {
            setError(playbackErrorText(message, detail, code));
            return;
          }
          // The stream server's other address only helps with network and HTTP errors.
          const alternate = source?.offlineId || !code.startsWith('ERROR_CODE_IO') ? undefined : alternates.current.shift();
          if (alternate) {
            appLog.info('player', `attempt ${attempt + 1}: retrying on the stream server ${alternate}`);
            setSource({ ...source, uri: alternate });
            return;
          }
          // A failed stream (not a download) moves on to the next attempt.
          if (!source?.offlineId && attempt < tvPlaybackAttempts(target.kind, target.container).length - 1) {
            setReady(false);
            setAttempt((a) => a + 1);
          } else setError(playbackErrorText(message, detail, code));
        }}
      />

      {/* Phones: full screen video; the navigation bar comes back when the player closes. */}
      {Platform.isTV ? null : <NavigationBar hidden />}

      {/* Android TV sends D-pad keys to JS only while a view has focus; nothing else is focusable here. See DECISIONS.md#d-028. */}
      {!drawer && !guide && !focusablesVisible && !error ? (
        <Pressable
          testID="player-focus"
          accessibilityLabel="Player"
          hasTVPreferredFocus
          style={StyleSheet.absoluteFill}
          onPress={onScreenTap}
        />
      ) : null}

      {!ready && !error ? <Loading label="Loading stream" /> : null}
      {error ? (
        <View style={styles.center}>
          <ErrorText>{error}</ErrorText>
          <FocusButton label="Go back" variant="primary" hasTVPreferredFocus onPress={() => navStore.getState().back()} />
        </View>
      ) : null}

      {flash ? <TapFlash direction={flash.direction} flashKey={flash.key} /> : null}
      {scrub ? <ScrubBar preview={scrub.preview} speed={scrub.speed} duration={duration} /> : null}

      {controls && !guide && !scrub && !error ? (
        // Web `.player__overlay`: back + title on top, timeline + controls at the bottom. On TV the remote drives them.
        <View style={styles.overlay} pointerEvents={Platform.isTV ? 'none' : 'box-none'} testID="player-controls">
          <Gradient
            stops={[
              { offset: 0, color: '#000', opacity: 0.7 },
              { offset: 0.2, color: '#000', opacity: 0 },
              { offset: 0.7, color: '#000', opacity: 0 },
              { offset: 1, color: '#000', opacity: 0.85 },
            ]}
          />
          <View style={[styles.top, { paddingHorizontal: sizes.gutter }]}>
            <IconButton
              icon="back"
              label="Back"
              plain
              focusable={!Platform.isTV}
              size={44}
              iconSize={28}
              onPress={() => navStore.getState().back()}
            />
            <View style={styles.heading}>
              <Text style={[styles.title, { fontSize: fluid(width, 16, 2, 22) }]} numberOfLines={1}>
                {target.title}
              </Text>
              {target.subtitle || source?.offlineId ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {[target.subtitle, source?.offlineId ? 'Downloaded' : null].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            {isLive ? <Text style={styles.live}>LIVE</Text> : null}
          </View>
          <View style={[styles.bottom, { paddingHorizontal: sizes.gutter }]}>
            {isLive ? null : (
              <View
                style={styles.timeline}
                accessibilityLabel="Seek"
                testID="player-timeline"
                {...timelinePan.panHandlers}
                onLayout={(event) => {
                  timelineWidth.current = event.nativeEvent.layout.width;
                  event.currentTarget.measure((_x, _y, _w, _h, pageX) => (timelineLeft.current = pageX));
                }}
              >
                <View style={styles.rail} pointerEvents="none">
                  <View style={[styles.played, { width: `${percent}%` }]} />
                  <View style={[styles.thumb, dragTime !== null && styles.thumbDragging, { left: `${percent}%` }]} />
                </View>
                {dragTime !== null ? (
                  <Text style={[styles.dragTime, { left: `${percent}%` }]} pointerEvents="none">
                    {formatClock(dragTime)}
                  </Text>
                ) : null}
              </View>
            )}
            <View style={styles.controls}>
              <IconButton
                icon={paused ? 'play' : 'pause'}
                label={paused ? 'Play' : 'Pause'}
                plain
                focusable={!Platform.isTV}
                size={44}
                iconSize={30}
                testID="player-toggle"
                onPress={() => setPaused((p) => !p)}
              />
              {isLive ? null : (
                <>
                  <IconButton
                    icon="rewind10"
                    label={`Back ${SKIP_SECONDS} seconds`}
                    plain
                    focusable={!Platform.isTV}
                    size={44}
                    iconSize={28}
                    onPress={() => seekTo(timeRef.current - SKIP_SECONDS)}
                  />
                  <IconButton
                    icon="forward10"
                    label={`Forward ${SKIP_SECONDS} seconds`}
                    plain
                    focusable={!Platform.isTV}
                    size={44}
                    iconSize={28}
                    onPress={() => seekTo(timeRef.current + SKIP_SECONDS)}
                  />
                  <Text style={styles.time} testID="player-time">
                    {formatClock(time)} / {formatClock(duration)}
                  </Text>
                </>
              )}
              <View style={styles.spacer} />
              {isLive ? (
                <IconButton
                  icon="guide"
                  label="Guide"
                  plain
                  focusable={!Platform.isTV}
                  size={44}
                  iconSize={26}
                  testID="player-guide"
                  onPress={() => setGuide(true)}
                />
              ) : null}
              {series.data ? (
                <IconButton
                  icon="episodes"
                  label="Episodes"
                  plain
                  focusable={!Platform.isTV}
                  size={44}
                  iconSize={26}
                  onPress={() => setDrawer(true)}
                />
              ) : null}
              <IconButton
                icon="subtitles"
                label="Audio and subtitles"
                plain
                focusable={!Platform.isTV}
                size={44}
                iconSize={26}
                onPress={() => setDrawer(true)}
              />
            </View>
          </View>
        </View>
      ) : null}

      {showSkipAhead ? (
        <View style={[styles.corner, { right: sizes.gutter }]} testID="skip-ahead-panel">
          {skipOpen ? (
            <View style={styles.skipOptions} accessibilityLabel="Skip ahead by">
              {SKIP_AHEAD_OPTIONS.map((seconds, index) => (
                <FocusButton
                  key={seconds}
                  label={skipAheadLabel(seconds)}
                  accessibilityLabel={skipAheadDescription(seconds)}
                  hasTVPreferredFocus={index === 0}
                  testID={`skip-ahead-${seconds}`}
                  onPress={() => {
                    setSkipOpen(false);
                    seekTo(timeRef.current + seconds);
                  }}
                />
              ))}
            </View>
          ) : null}
          <FocusButton
            label="Skip ahead"
            icon={skipOpen ? 'close' : 'forward10'}
            accessibilityLabel={skipOpen ? 'Close skip options' : 'Skip ahead: choose how far'}
            hasTVPreferredFocus={!skipOpen}
            onPress={() => setSkipOpen((open) => !open)}
            testID="skip-ahead"
          />
        </View>
      ) : null}

      {countdown !== null && next ? (
        <View style={[styles.nextUp, { right: sizes.gutter }]} testID="next-up">
          <Text style={styles.nextLabel}>Next episode in {Math.min(countdown, NEXT_UP_COUNTDOWN_SECONDS)}</Text>
          <Text style={styles.nextTitle}>
            {episodeLabel(next)} · {next.title}
          </Text>
          <View style={styles.row}>
            <FocusButton label="Play Now" variant="primary" hasTVPreferredFocus onPress={playNext} testID="play-next" />
            <FocusButton label="Cancel" onPress={() => setNextDismissed(true)} />
          </View>
        </View>
      ) : null}

      {guide ? (
        <GuideOverlay channelId={target.streamId} categoryId={target.categoryId ?? null} onSelect={zap} onClose={() => setGuide(false)} />
      ) : null}

      {drawer ? (
        <QuickDrawer
          tracks={tracks}
          variants={variants}
          currentStreamId={target.streamId}
          series={series.data}
          onTrack={(type, group, track) => void playerRef.current?.selectTrack(type, group, track)}
          onVariant={(v) => {
            setDrawer(false);
            switchVariant(v);
          }}
          onEpisode={(episode) => {
            setDrawer(false);
            saveProgress();
            navStore.getState().replaceTop({
              name: 'player',
              target: episodeTarget(
                { title: target.title, masterId: target.masterId, seriesId: target.seriesId!, posterUrl: target.posterUrl },
                episode,
              ),
            });
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 20 },
  heading: { flexShrink: 1 },
  title: { color: colors.strong, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14.4, marginTop: 2 },
  live: {
    color: colors.strong,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
    overflow: 'hidden',
    fontSize: fonts.tiny,
    fontWeight: '700',
  },
  bottom: { paddingBottom: 20 },
  // Tall enough to grab with a finger; the rail is drawn in the middle.
  timeline: { height: 32, justifyContent: 'center' },
  rail: { height: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  played: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent },
  thumb: { position: 'absolute', top: -5, width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: colors.accent },
  thumbDragging: { top: -8, width: 20, height: 20, marginLeft: -10, borderRadius: 10 },
  dragTime: {
    position: 'absolute',
    bottom: 22,
    width: 80,
    marginLeft: -40,
    textAlign: 'center',
    color: colors.strong,
    fontSize: fonts.small,
    fontWeight: '700',
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  time: { color: colors.strong, fontSize: 14.4, fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
  corner: { position: 'absolute', bottom: 120, alignItems: 'flex-end', gap: 8 },
  skipOptions: { flexDirection: 'row', gap: 8 },
  nextUp: {
    position: 'absolute',
    bottom: 120,
    width: 360,
    maxWidth: '90%',
    padding: 16,
    gap: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(20,20,20,0.95)',
  },
  nextLabel: { color: colors.muted, fontSize: fonts.small },
  nextTitle: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
});
