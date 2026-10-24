import Hls from 'hls.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  liveTarget,
  appLog,
  describeProbe,
  probeHint,
  probeMessage,
  probeStream,
  NEXT_UP_COUNTDOWN_SECONDS,
  SKIP_SECONDS,
  SkipStreak,
  findProgress,
  formatClock,
  offlineAccess,
  isInSkipAheadWindow,
  skipAheadDescription,
  skipAheadLabel,
  skipAheadWindow,
  SKIP_AHEAD_OPTIONS,
  episodeLabel,
  nextUpCountdown,
  resumePosition,
  chooseVersion,
  pickTrack,
  playbackChoices,
  rememberPlayback,
  usesPlaybackChoices,
  type VariantInfo,
  t,
  isFoundSubtitle,
  srtToVtt,
  checkConnectionLimit,
  connectionCheckNeeded,
  connectionLimitMessage,
  holdStreamConnection,
  spareConnection,
  type ConnectionUse,
  isLiveStream,
} from '@iptv/shared';
import { api, appContext, downloadsStore, stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/Spinner';
import { useVlc } from '../../components/vlc';
import { desktop } from '../../desktop';
import { useNoteRecentChannel, usePlayerTitle, useSession, useUi } from '../../hooks/stores';
import { savePlaybackProgress } from '@iptv/shared';
import { selectDownload } from '../../offline/downloadsStore';
import { episodeTarget } from '../../ui/targets';
import type { PlayTarget } from '../../ui/uiStore';
import { GuideOverlay, QuickDrawer } from '@iptv/screens';
import '../browse/screenHost';
import { ConvertedFrames, FrameGrabber, type FramePreview } from './frameGrabber';
import { NextUp } from './NextUp';
import { PlaybackEngine, PlaybackUnavailableError, undecodableVideoCodec, type LoadedSource } from './playbackEngine';
import { Timeline } from './Timeline';
import { activeSubtitle, addSubtitle, audioTracks, removeAddedSubtitle, showSubtitle, subtitleTracks, trackOptions } from './tracks';
import { usePauseOnAudioOutputLoss } from './audioOutput';

const PROGRESS_SAVE_MS = 10_000;
const IDLE_MS = 3000;
/** How long a notice (e.g. the subtitle OpenSubtitles added, D-111) stays up. */
const NOTICE_MS = 4000;
/** How long a video plays before a missing sound counts as a codec Chromium lacks (issue #236). */
const SOUND_CHECK_MS = 4000;

type Status = 'loading' | 'ready' | 'error';

/** Full-screen player. Keyboard: Space/K play, ←/→ ±10 s, ↑/↓ volume, M mute, F fullscreen, Esc close. */
export function PlayerOverlay({ target }: { target: PlayTarget }) {
  const root = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  usePauseOnAudioOutputLoss(videoRef);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const previewRef = useRef<FramePreview | null>(null);
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  // The provider's server stopped sending the video: the message offers Try again, from where it stopped (D-074).
  const [retryable, setRetryable] = useState(false);
  const [retry, setRetry] = useState(0);
  const resumeAt = useRef<number | null>(null);
  // The format itself is the problem (AVI …). The desktop app offers VLC for any failure (issue #236, D-057).
  const [unsupportedFormat, setUnsupportedFormat] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  // A short message over the video, e.g. the subtitle OpenSubtitles added (D-111).
  const [notice, setNotice] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [panel, setPanel] = useState<'tracks' | 'episodes' | 'guide' | null>(null);
  // "Skip ahead" options (30 s … 3 min) open under the button; the button or Escape closes them.
  const [skipOpen, setSkipOpen] = useState(false);
  const [nextDismissed, setNextDismissed] = useState(false);
  const [flash, setFlash] = useState<{ side: 'back' | 'forward'; key: number; seconds: number } | null>(null);
  const [, setTracksVersion] = useState(0);

  // A past programme from the provider's recordings plays like a video: seeking, no LIVE tag (issue #226).
  const isLive = isLiveStream(target);
  const vlc = useVlc();

  // Series context for the episodes drawer and next-up: all versions' episode lists, merged (D-066); a movie's
  // versions for the in-player selector. Shared with the TV app (D-079).
  const revision = useUi((s) => s.libraryRevision);
  const { series, next, previous, variants } = usePlayerTitle(target, revision);
  // Live: Home's first row lists the channels watched last (issue #122).
  useNoteRecentChannel(target);

  const saveProgress = useCallback(() => {
    const engine = engineRef.current;
    if (engine && !isLive) savePlaybackProgress(stores.progress, target, engine.position, engine.duration);
  }, [target, isLive]);

  // Another title starts where its own target says.
  useEffect(() => {
    resumeAt.current = null;
  }, [target.kind, target.streamId]);

  // All the account's streams in use (issue #242, D-175): asks before opening another. 'checking' while the provider
  // answers; skipped for a download and while the provider still counts the app's own stream (zapping, next episode).
  const [limit, setLimit] = useState<ConnectionUse | 'checking' | null>(() => {
    const download = target.kind === 'live' ? null : selectDownload(downloadsStore.getState(), target.kind, target.streamId);
    return download?.status !== 'completed' && api.playback.connections && connectionCheckNeeded() ? 'checking' : null;
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
  useEffect(() => (source && !source.offline ? holdStreamConnection() : undefined), [source]);

  // Load the stream whenever the item changes. The completed download (if any) is read once at start.
  useEffect(() => {
    if (waiting) return;
    const download = target.kind === 'live' ? null : selectDownload(downloadsStore.getState(), target.kind, target.streamId);
    // A blocked download is skipped: online it streams instead; offline there is nothing else to play (D-050).
    const session = stores.session.getState();
    const access = offlineAccess(session.account, session.lastOnlineAt);
    if (download?.status === 'completed' && !access.allowed && session.offline) {
      setError(access.message);
      setStatus('error');
      return;
    }
    const offlineRecord = access.allowed ? download : null;
    const video = videoRef.current!;
    const engine = new PlaybackEngine(video, api);
    engineRef.current = engine;
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    setRetryable(false);
    setUnsupportedFormat(false);
    setNextDismissed(false);
    setPanel(null);
    // What the provider sent instead of a video (an error page such as "max connections"), in the log and, when
    // recognised, as the message (D-074; the TV app does the same).
    const explain = () => {
      const url = engine.attempted.at(-1);
      if (!url) return;
      void probeStream(url).then((probe) => {
        // Logged even when the player was closed meanwhile: the log is where the answer is needed.
        appLog.warn('player', `the provider answered ${describeProbe(probe)}`);
        if (controller.signal.aborted) return;
        const codec = probe.status >= 200 && probe.status < 300 ? undecodableVideoCodec(probe.codecs, video) : null;
        const text = codec
          ? desktop
            ? t("This title uses {codec} video, which this computer can't decode. Open it in VLC or pick another version.", { codec })
            : t("This title uses {codec} video, which this browser can't decode. Pick another version or watch it on the TV app.", {
                codec,
              })
          : probeMessage(probeHint(probe));
        if (text) setError(text);
      });
    };
    // Desktop: what Chromium cannot decode now plays converted by the app's FFmpeg (issue #236).
    engine.onConverted((loaded) => {
      setSource(loaded);
      setStatus('ready');
    });
    // Every audio track is converted (issue #270): it starts with the profile's (D-087).
    if (usesPlaybackChoices(target)) engine.choosesAudio((tracks) => pickTrack(tracks, playbackChoices(stores).audio));
    engine.onFatalError((message, network) => {
      setError(message);
      setRetryable(!!network && !isLive);
      setStatus('error');
      explain();
    });

    const saved = target.kind === 'live' ? null : findProgress(stores.progress.getState(), target.kind, target.streamId);
    const start = isLive ? 0 : (resumeAt.current ?? target.startAt ?? resumePosition(saved));
    engine
      .load(
        { kind: target.kind, streamId: target.streamId, container: target.container, catchup: target.catchup },
        offlineRecord,
        controller.signal,
        start,
      )
      .then(
        (loaded) => {
          setSource(loaded);
          setStatus('ready');
          if (start > 0) engine.seek(start);
          void video.play().catch(() => setPlaying(false));
          engine.hls?.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => setTracksVersion((v) => v + 1));
          engine.hls?.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => setTracksVersion((v) => v + 1));
          // The profile's subtitles and audio track (D-087), selected once their tracks are known.
          if (!usesPlaybackChoices(target)) return;
          const choices = playbackChoices(stores);
          const pending = { subtitles: Boolean(choices.subtitles), audio: Boolean(choices.audio) };
          const applyChoices = () => {
            if (controller.signal.aborted) return;
            const hls = engine.hls;
            const subtitles = subtitleTracks(hls, video);
            if (pending.subtitles && subtitles.length > 0) {
              pending.subtitles = false;
              const pick = pickTrack(subtitles, choices.subtitles);
              if (pick !== null && pick !== activeSubtitle(hls, video)) showSubtitle(hls, video, pick);
            }
            const audio = audioTracks(hls);
            if (pending.audio && hls && audio.length > 0) {
              pending.audio = false;
              const pick = pickTrack(audio, choices.audio);
              if (pick !== null && pick >= 0 && pick !== hls.audioTrack) hls.audioTrack = pick;
            }
            if (!pending.subtitles && !pending.audio) stopWatching();
            setTracksVersion((v) => v + 1);
          };
          const stopWatching = () => {
            engine.hls?.off(Hls.Events.SUBTITLE_TRACKS_UPDATED, applyChoices);
            engine.hls?.off(Hls.Events.AUDIO_TRACKS_UPDATED, applyChoices);
            video.textTracks.removeEventListener('addtrack', applyChoices);
          };
          engine.hls?.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, applyChoices);
          engine.hls?.on(Hls.Events.AUDIO_TRACKS_UPDATED, applyChoices);
          if (!engine.hls) {
            pending.audio = false;
            video.textTracks.addEventListener('addtrack', applyChoices);
          }
          controller.signal.addEventListener('abort', stopWatching);
          applyChoices();
          // OpenSubtitles (D-111): a subtitle in a preferred language when the stream has none of its own.
          const year =
            target.kind === 'movie' && target.masterId ? stores.library.getState().details[`movies|${target.masterId}`]?.data?.year : null;
          void appContext.subtitles
            .find(target, { trackLanguages: subtitleTracks(engine.hls, video).map((track) => track.language), year: year ?? null })
            .then((found) => {
              if (controller.signal.aborted) return;
              if (!isFoundSubtitle(found)) {
                if (found.message) setNotice(found.message);
                return;
              }
              addSubtitle(engine.hls, video, srtToVtt(found.srt), found.language, found.label);
              setNotice(t('Subtitles: {label}', { label: found.label }));
              setTracksVersion((v) => v + 1);
            });
        },
        (loadError: unknown) => {
          if (controller.signal.aborted) return;
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setStatus('error');
          const unsupported = loadError instanceof PlaybackUnavailableError && loadError.unsupportedFormat;
          setUnsupportedFormat(unsupported);
          if (!unsupported) explain();
        },
      );

    return () => {
      controller.abort();
      removeAddedSubtitle(video);
      saveProgress();
      previewRef.current?.destroy();
      previewRef.current = null;
      engine.destroy();
      engineRef.current = null;
      setSource(null);
    };
    // Reload only when the playing item changes; saveProgress is refreshed with the same target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.kind, target.streamId, retry, waiting]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Periodic progress save while playing.
  useEffect(() => {
    if (!playing || isLive) return;
    const timer = setInterval(saveProgress, PROGRESS_SAVE_MS);
    return () => clearInterval(timer);
  }, [playing, isLive, saveProgress]);

  const seekTo = useCallback((seconds: number) => {
    engineRef.current?.seek(seconds);
  }, []);

  // Desktop: a few seconds in, a video without any sound has audio Chromium cannot decode; the app converts it from
  // there (issue #236).
  useEffect(() => {
    const engine = engineRef.current;
    if (!playing || !engine || !source || source.converted) return;
    const timer = setTimeout(() => {
      if (!engine.soundMissing()) return;
      setNotice(t('Converting the sound for this computer…'));
      void engine.convertHere().then((loaded) => {
        if (!loaded || engineRef.current !== engine) return;
        setSource(loaded);
        void videoRef.current?.play().catch(() => setPlaying(false));
      });
    }, SOUND_CHECK_MS);
    return () => clearTimeout(timer);
  }, [playing, source]);

  // Presses in a row skip 10 s, 30 s, 1 min, 2 min, then 5 min (D-128); a held key's repeats stay at 10 s.
  const skipStreak = useRef(new SkipStreak()).current;
  const skip = useCallback(
    (side: 'back' | 'forward', repeat = false) => {
      const engine = engineRef.current;
      if (!engine) return;
      const seconds = repeat ? SKIP_SECONDS : skipStreak.press(side);
      seekTo(engine.position + (side === 'back' ? -seconds : seconds));
      setFlash({ side, key: Date.now(), seconds });
    },
    [seekTo, skipStreak],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  }, []);

  // Another episode of this series (next up, previous/next buttons, the episodes drawer) replaces this playback.
  const playEpisode = useCallback(
    (episode: NonNullable<typeof next>) => {
      saveProgress();
      uiStore
        .getState()
        .replacePlayback(
          episodeTarget(
            { title: target.title, masterId: target.masterId, seriesId: episode.seriesId, posterUrl: target.posterUrl },
            episode,
          ),
        );
    },
    [target, saveProgress],
  );
  const playNext = useCallback(() => {
    if (next && series && target.seriesId) playEpisode(next);
  }, [next, series, target.seriesId, playEpisode]);

  const switchVariant = (variant: VariantInfo) => {
    const engine = engineRef.current;
    saveProgress();
    chooseVersion(stores, target.masterId!, variant);
    uiStore.getState().replacePlayback({
      ...target,
      streamId: variant.streamId,
      container: variant.containerExtension,
      subtitle: variant.label,
      startAt: engine?.position ?? 0,
    });
  };

  const close = useCallback(() => {
    saveProgress();
    if (document.fullscreenElement) void document.exitFullscreen();
    uiStore.getState().stopPlayback();
  }, [saveProgress]);

  // Keyboard shortcuts.
  // Media keys (keyboards, headsets; issue #178): the browser hands them to the media session.
  useEffect(() => {
    const session = typeof navigator === 'undefined' ? undefined : navigator.mediaSession;
    if (!session) return;
    const actions: [MediaSessionAction, () => void][] = [
      ['play', () => void videoRef.current?.play()],
      ['pause', () => videoRef.current?.pause()],
      ['stop', close],
      ['seekbackward', () => !isLive && skip('back')],
      ['seekforward', () => !isLive && skip('forward')],
    ];
    for (const [action, handler] of actions) {
      try {
        session.setActionHandler(action, () => {
          handler();
          wake();
        });
      } catch {
        // An action this browser does not support.
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // As above.
        }
      }
    };
  }, [skip, close, isLive]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const video = videoRef.current;
      const handled = (() => {
        switch (event.key) {
          case ' ':
          case 'k':
            togglePlay();
            return true;
          case 'ArrowLeft':
            if (!isLive) skip('back', event.repeat);
            return true;
          case 'ArrowRight':
            if (!isLive) skip('forward', event.repeat);
            return true;
          case 'ArrowUp':
            if (video) video.volume = Math.min(1, video.volume + 0.1);
            return true;
          case 'ArrowDown':
            if (video) video.volume = Math.max(0, video.volume - 0.1);
            return true;
          case 'm':
            if (video) video.muted = !video.muted;
            return true;
          case 'f':
            toggleFullscreen();
            return true;
          // Live: the guide over the channel (↑ on TV; here ↑/↓ are the volume).
          case 'g':
            if (!isLive) return false;
            setPanel(panel === 'guide' ? null : 'guide');
            return true;
          case 'Escape':
            if (skipOpen) setSkipOpen(false);
            else if (panel) setPanel(null);
            else if (!document.fullscreenElement) close();
            return true;
          default:
            return false;
        }
      })();
      if (handled) {
        event.preventDefault();
        wake();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, skip, toggleFullscreen, close, isLive, panel, skipOpen]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Auto-hide controls after inactivity while playing.
  const idleTimer = useRef<number | undefined>(undefined);
  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  };
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  // The preview opens a second connection: only where the account has one to spare (issue #218).
  const maxConnections = useSession((s) => s.account?.maxConnections ?? null);
  const getPreview = useCallback(() => {
    if (!source || isLive || source.engine === 'mpegts') return null;
    // A download needs no connection; anything else opens a second one.
    if (!source.offline && !spareConnection(maxConnections)) return null;
    if (source.converted) {
      // A converted title (issue #236): the app's FFmpeg takes the pictures (issue #270).
      const stream = engineRef.current?.convertedStream;
      const frame = desktop?.transcode?.frame;
      if (!stream || !frame) return null;
      previewRef.current ??= new ConvertedFrames(stream, frame);
      return previewRef.current;
    }
    previewRef.current ??= new FrameGrabber(source);
    return previewRef.current;
  }, [source, isLive, maxConnections]);

  const skipWindow = skipAheadWindow(target.kind, duration);
  const countdown = nextDismissed ? null : nextUpCountdown(time, duration, !!next);

  return (
    <div ref={root} className={`player${idle && playing && !panel ? ' player--idle' : ''}`} onMouseMove={wake} data-testid="player">
      <video
        ref={videoRef}
        className="player__video"
        crossOrigin="anonymous"
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          saveProgress();
        }}
        onTimeUpdate={() => {
          const engine = engineRef.current;
          if (!engine) return;
          setTime(engine.position);
          setBuffered(engine.bufferedEnd);
          setDuration(engine.duration);
        }}
        onDurationChange={() => {
          if (engineRef.current) setDuration(engineRef.current.duration);
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={() => {
          saveProgress();
          if (next && !nextDismissed) playNext();
        }}
      />

      {flash ? (
        <div key={flash.key} className={`skip-flash skip-flash--${flash.side}`}>
          {flash.side === 'back' ? '−' : '+'}
          {flash.seconds < 60 ? `${flash.seconds}s` : formatClock(flash.seconds)}
        </div>
      ) : null}

      <div className="player__overlay">
        <div className="player__top">
          <button type="button" className="player__control" onClick={close} aria-label={t('Back')}>
            <Icon name="back" size={32} />
          </button>
          <div className="player__heading">
            <h2 className="player__title">{target.title}</h2>
            {target.subtitle ? (
              <p className="player__subtitle">
                {target.subtitle}
                {source?.offline ? ` · ${t('Downloaded')}` : ''}
              </p>
            ) : null}
          </div>
          {isLive ? <span className="player__live">{t('LIVE')}</span> : null}
        </div>

        <div className="player__bottom">
          {!isLive ? (
            <Timeline currentTime={time} duration={duration} bufferedEnd={buffered} onSeek={seekTo} getPreview={getPreview} />
          ) : null}
          <div className="player__controls">
            <button type="button" className="player__control" onClick={togglePlay} aria-label={playing ? t('Pause') : t('Play')}>
              <Icon name={playing ? 'pause' : 'play'} size={36} />
            </button>
            {!isLive ? (
              <>
                <button
                  type="button"
                  className="player__control"
                  onClick={() => seekTo(0)}
                  aria-label={t('Play from the beginning')}
                  title={t('Play from the beginning')}
                >
                  <Icon name="restart" size={30} />
                </button>
                {previous ? (
                  <button
                    type="button"
                    className="player__control"
                    onClick={() => playEpisode(previous)}
                    aria-label={t('Previous episode: {episode}', { episode: episodeLabel(previous) })}
                    title={t('Previous episode: {episode}', { episode: episodeLabel(previous) })}
                  >
                    <Icon name="previous" size={30} />
                  </button>
                ) : null}
                <button type="button" className="player__control" onClick={() => skip('back')} aria-label={t('Back 10 seconds')}>
                  <Icon name="rewind10" size={32} />
                </button>
                <button type="button" className="player__control" onClick={() => skip('forward')} aria-label={t('Forward 10 seconds')}>
                  <Icon name="forward10" size={32} />
                </button>
                {next ? (
                  <button
                    type="button"
                    className="player__control"
                    onClick={() => playEpisode(next)}
                    aria-label={t('Next episode: {episode}', { episode: episodeLabel(next) })}
                    title={t('Next episode: {episode}', { episode: episodeLabel(next) })}
                  >
                    <Icon name="next" size={30} />
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="player__control"
              onClick={() => videoRef.current && (videoRef.current.muted = !muted)}
              aria-label={muted ? t('Unmute') : t('Mute')}
            >
              <Icon name={muted || volume === 0 ? 'mute' : 'volume'} size={28} />
            </button>
            <input
              className="player__volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label={t('Volume')}
              onChange={(e) => {
                const video = videoRef.current;
                if (video) {
                  video.volume = Number(e.target.value);
                  video.muted = false;
                }
              }}
            />
            {!isLive ? (
              <span className="player__time">
                {formatClock(time)} / {formatClock(duration)}
              </span>
            ) : null}
            <span className="spacer" />
            {isLive ? (
              <button
                type="button"
                className="player__control"
                onClick={() => setPanel(panel === 'guide' ? null : 'guide')}
                aria-label={t('Guide')}
                title={t('Guide (G)')}
              >
                <Icon name="guide" size={28} />
              </button>
            ) : null}
            {series ? (
              <button
                type="button"
                className="player__control"
                onClick={() => setPanel(panel === 'episodes' ? null : 'episodes')}
                aria-label={t('Episodes')}
              >
                <Icon name="episodes" size={28} />
              </button>
            ) : null}
            <button
              type="button"
              className="player__control"
              onClick={() => setPanel(panel === 'tracks' ? null : 'tracks')}
              aria-label={t('Audio, subtitles and version')}
            >
              <Icon name="subtitles" size={28} />
            </button>
            <button
              type="button"
              className="player__control"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? t('Exit full screen') : t('Full screen')}
            >
              <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} size={30} />
            </button>
          </div>
        </div>
      </div>

      {full ? (
        <div className="player__center">
          <div className="player__message" role="alert" data-testid="player-connection-limit">
            <p>{connectionLimitMessage(full)}</p>
            <div className="player__message-actions">
              <button type="button" className="button button--primary" onClick={() => setLimit(null)}>
                {t('Play anyway')}
              </button>
              <button type="button" className="button" onClick={close}>
                {t('Go back')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {status === 'loading' && !full ? (
        <div className="player__center">
          <Spinner label={t('Loading stream')} />
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="player__center">
          <div className="player__message" role="alert">
            <p>
              {unsupportedFormat && vlc
                ? t(
                    "This version is only available as {container}, which this app can't play itself. Open it in VLC or pick another version.",
                    {
                      container: (target.container ?? '').toUpperCase(),
                    },
                  )
                : error}
            </p>
            <div className="player__message-actions">
              {retryable ? (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    const at = engineRef.current?.position ?? 0;
                    if (at > 0) resumeAt.current = at;
                    setRetry((r) => r + 1);
                  }}
                >
                  {t('Try again')}
                </button>
              ) : null}
              {vlc ? (
                <button
                  type="button"
                  className={retryable ? 'button' : 'button button--primary'}
                  onClick={() => {
                    vlc(target);
                    close();
                  }}
                >
                  {t('Open in VLC')}
                </button>
              ) : null}
              <button type="button" className={vlc || retryable ? 'button' : 'button button--primary'} onClick={close}>
                {t('Go back')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status === 'ready' && (skipOpen || isInSkipAheadWindow(skipWindow, time)) ? (
        <div className="player__skip-ahead">
          {skipOpen ? (
            <div className="player__skip-options" role="group" aria-label={t('Skip ahead by')}>
              {SKIP_AHEAD_OPTIONS.map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  className="player__skip-button"
                  aria-label={skipAheadDescription(seconds)}
                  onClick={() => {
                    setSkipOpen(false);
                    seekTo((engineRef.current?.position ?? time) + seconds);
                  }}
                >
                  {skipAheadLabel(seconds)}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="player__skip-button"
            aria-expanded={skipOpen}
            aria-label={skipOpen ? t('Close skip options') : t('Skip ahead: choose how far')}
            onClick={() => setSkipOpen(!skipOpen)}
          >
            <Icon name={skipOpen ? 'close' : 'forward10'} size={20} /> {t('Skip ahead')}
          </button>
        </div>
      ) : null}

      {notice && status !== 'error' ? (
        <div className="player__notice" role="status">
          {notice}
        </div>
      ) : null}

      {status === 'ready' && countdown !== null && next ? (
        <NextUp
          episode={next}
          secondsLeft={Math.min(countdown, NEXT_UP_COUNTDOWN_SECONDS)}
          onPlayNow={playNext}
          onDismiss={() => setNextDismissed(true)}
        />
      ) : null}

      {/* The TV's Audio, Subtitles, Versions and Episodes panel (DECISIONS.md#d-210): the subtitles button opens it on
          Audio, the episodes button on Episodes. */}
      {panel === 'tracks' || panel === 'episodes' ? (
        <QuickDrawer
          initialTab={panel === 'episodes' ? 'episodes' : 'audio'}
          onClose={() => setPanel(null)}
          {...trackOptions(engineRef.current?.hls ?? null, videoRef.current, {
            audio: (choice) => {
              if (usesPlaybackChoices(target)) rememberPlayback(stores, { audio: choice });
            },
            subtitles: (choice) => {
              if (usesPlaybackChoices(target)) rememberPlayback(stores, { subtitles: choice });
            },
            changed: () => setTracksVersion((v) => v + 1),
          })}
          variants={variants}
          currentStreamId={target.streamId}
          series={series && target.seriesId ? series : null}
          onVariant={(variant) => {
            setPanel(null);
            switchVariant(variant);
          }}
          onEpisode={(episode) => {
            setPanel(null);
            playEpisode(episode);
          }}
        />
      ) : null}
      {panel === 'guide' && isLive ? (
        <GuideOverlay
          channelId={target.streamId}
          categoryId={target.categoryId ?? null}
          onClose={() => setPanel(null)}
          onSelect={(channel, programme) => {
            setPanel(null);
            if (channel.id !== target.streamId) uiStore.getState().replacePlayback(liveTarget(channel, programme?.title));
          }}
        />
      ) : null}
    </div>
  );
}
