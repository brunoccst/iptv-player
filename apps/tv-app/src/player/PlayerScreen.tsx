import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NEXT_UP_COUNTDOWN_SECONDS,
  RemoteSeekController,
  SKIP_SECONDS,
  clampTime,
  episodeLabel,
  episodeTarget,
  findProgress,
  formatClock,
  introWindow,
  isInIntro,
  nextEpisode,
  nextUpCountdown,
  resumePosition,
  tvPlaybackAttempts,
  type PlayTarget,
  type SeekDirection,
  type VariantInfo,
} from '@iptv/shared';
import { TvPlayerView, type PlayerSource, type PlayerTrack, type TvPlayerViewRef } from '../../modules/tv-media';
import { api, downloadsStore, navStore, stores } from '../appContext';
import { ErrorText, Loading } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { selectDownload } from '../downloads/downloadsStore';
import { useLibrary } from '../hooks';
import { useRemote } from '../tv/remote';
import { colors, fonts, safe, spacing } from '../theme';
import { useAsync } from '../useAsync';
import { QuickDrawer } from './QuickDrawer';
import { ScrubBar, TapFlash } from './SeekOverlay';

const PROGRESS_SAVE_MS = 10_000;
const CONTROLS_HIDE_MS = 4000;

/**
 * Full-screen player. Remote: tap ←/→ ±10 s, hold ←/→ scrub, ↑/↓ quick drawer, Select play/pause, Back close.
 * See DECISIONS.md#d-028.
 */
export function PlayerScreen({ target }: { target: PlayTarget }) {
  const playerRef = useRef<TvPlayerViewRef>(null);
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<PlayerTrack[]>([]);
  const [controls, setControls] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [flash, setFlash] = useState<{ direction: SeekDirection; key: number } | null>(null);
  const [scrub, setScrub] = useState<{ preview: number; speed: number } | null>(null);
  const [nextDismissed, setNextDismissed] = useState(false);
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  const isLive = target.kind === 'live';

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
    const saved = target.kind === 'live' ? null : findProgress(stores.progress.getState(), target.kind, target.streamId);
    const startPositionMs = (target.startAt ?? resumePosition(saved)) * 1000;
    const offline = target.kind === 'live' ? null : selectDownload(downloadsStore.getState(), target.kind, target.streamId);
    if (offline?.state === 'completed' && attempt === 0) {
      setSource({ offlineId: offline.id, startPositionMs });
      return;
    }
    const plan = tvPlaybackAttempts(target.kind, target.container);
    const step = plan[offline?.state === 'completed' ? attempt - 1 : attempt];
    if (!step) {
      setError('This stream could not be played. The provider may be offline.');
      return;
    }
    api.playback.get(target.kind, target.streamId, step.container).then(
      (info) => !cancelled && setSource({ uri: info.url, isHls: step.engine === 'hls', startPositionMs }),
      () => !cancelled && setAttempt((a) => a + 1),
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

  const intro = introWindow(target.kind, duration);
  const showSkipIntro = ready && isInIntro(intro, time);
  const countdown = nextDismissed ? null : nextUpCountdown(time, duration, !!next);
  const focusablesVisible = showSkipIntro || countdown !== null;

  useRemote(({ key, action }) => {
    if (drawer || error) return;
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
    if (key === 'up' || key === 'down') setDrawer(true);
    else if (key === 'rewind' && !isLive) seekTo(timeRef.current - SKIP_SECONDS);
    else if (key === 'fastForward' && !isLive) seekTo(timeRef.current + SKIP_SECONDS);
  });

  // Back: close the drawer first (registered after the shell's handler, so it runs first).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!drawer) return false;
      setDrawer(false);
      return true;
    });
    return () => subscription.remove();
  }, [drawer]);

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

  return (
    <View style={styles.screen} testID="player-screen">
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
          // A failed stream (not a download) moves on to the next attempt.
          if (!source?.offlineId && attempt < tvPlaybackAttempts(target.kind, target.container).length - 1) {
            setReady(false);
            setAttempt((a) => a + 1);
          } else setError(e.nativeEvent.message);
        }}
      />

      {/* Android TV sends D-pad keys to JS only while a view has focus; nothing else is focusable here. See DECISIONS.md#d-028. */}
      {!drawer && !focusablesVisible && !error ? (
        <Pressable
          testID="player-focus"
          accessibilityLabel="Player"
          hasTVPreferredFocus
          style={StyleSheet.absoluteFill}
          onPress={() => {}}
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

      {controls && !scrub && !error ? (
        <View style={styles.overlay} pointerEvents="none" testID="player-controls">
          <View>
            <Text style={styles.title} numberOfLines={1}>
              {target.title}
            </Text>
            {target.subtitle ? (
              <Text style={styles.subtitle}>
                {target.subtitle}
                {source?.offlineId ? ' · Downloaded' : ''}
              </Text>
            ) : null}
          </View>
          <View>
            {isLive ? (
              <Text style={styles.live}>LIVE</Text>
            ) : (
              <>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${duration > 0 ? (time / duration) * 100 : 0}%` }]} />
                </View>
                <Text style={styles.time} testID="player-time">
                  {formatClock(time)} / {formatClock(duration)}
                  {paused ? '  ❚❚ Paused' : ''}
                </Text>
              </>
            )}
            <Text style={styles.hint}>
              ◀ ▶ skip {SKIP_SECONDS}s · hold to scrub · ▲ ▼ audio, subtitles{series.data ? ', episodes' : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {showSkipIntro && intro ? (
        <View style={styles.corner}>
          <FocusButton label="Skip Intro" hasTVPreferredFocus onPress={() => seekTo(intro.end)} testID="skip-intro" />
        </View>
      ) : null}

      {countdown !== null && next ? (
        <View style={styles.nextUp} testID="next-up">
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
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: safe.horizontal },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingHorizontal: safe.horizontal,
    paddingVertical: safe.vertical,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: fonts.body },
  live: { color: colors.strong, backgroundColor: colors.accent, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, fontWeight: '700' },
  track: { height: 5, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: spacing.sm },
  fill: { height: 5, backgroundColor: colors.accent },
  time: { color: colors.strong, fontSize: fonts.body },
  hint: { color: colors.muted, fontSize: fonts.small, marginTop: spacing.xs },
  corner: { position: 'absolute', right: safe.horizontal, bottom: safe.vertical + 70 },
  nextUp: {
    position: 'absolute',
    right: safe.horizontal,
    bottom: safe.vertical + 70,
    backgroundColor: 'rgba(20,20,20,0.95)',
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.sm,
    width: 340,
  },
  nextLabel: { color: colors.muted, fontSize: fonts.small },
  nextTitle: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm },
});
