import Hls from 'hls.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  liveTarget,
  appLog,
  describeProbe,
  probeHint,
  probeMessage,
  probeStream,
  NEXT_UP_COUNTDOWN_SECONDS,
  SKIP_SECONDS,
  clampTime,
  findProgress,
  formatClock,
  offlineAccess,
  isInSkipAheadWindow,
  skipAheadDescription,
  skipAheadLabel,
  skipAheadWindow,
  SKIP_AHEAD_OPTIONS,
  loadSeriesVersions,
  mergeSeriesVersions,
  episodeLabel,
  nextEpisode,
  previousEpisode,
  playerSeriesVersions,
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
} from '@iptv/shared';
import { api, appContext, downloadsStore, stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/Spinner';
import { useLibrary, useUi } from '../../hooks/stores';
import { useAsync } from '../../hooks/useAsync';
import { selectDownload } from '../../offline/downloadsStore';
import { episodeTarget } from '../../ui/targets';
import type { PlayTarget } from '../../ui/uiStore';
import { EpisodesDrawer } from './EpisodesDrawer';
import { GuidePanel } from './GuidePanel';
import { FrameGrabber } from './frameGrabber';
import { NextUp } from './NextUp';
import { PlaybackEngine, PlaybackUnavailableError, type LoadedSource } from './playbackEngine';
import { Timeline } from './Timeline';
import { TracksMenu } from './TracksMenu';
import { activeSubtitle, addSubtitle, audioTracks, removeAddedSubtitle, showSubtitle, subtitleTracks } from './tracks';
import { usePauseOnAudioOutputLoss } from './audioOutput';

const PROGRESS_SAVE_MS = 10_000;
const IDLE_MS = 3000;
/** How long a notice (e.g. the subtitle OpenSubtitles added, D-111) stays up. */
const NOTICE_MS = 4000;

type Status = 'loading' | 'ready' | 'error';

/** Full-screen player. Keyboard: Space/K play, ←/→ ±10 s, ↑/↓ volume, M mute, F fullscreen, Esc close. */
export function PlayerOverlay({ target }: { target: PlayTarget }) {
  const root = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  usePauseOnAudioOutputLoss(videoRef);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const previewRef = useRef<FrameGrabber | null>(null);
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
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
  const [flash, setFlash] = useState<{ side: 'back' | 'forward'; key: number } | null>(null);
  const [, setTracksVersion] = useState(0);

  const isLive = target.kind === 'live';

  // Series context for the episodes drawer and next-up: all versions' episode lists, merged (D-066).
  const seriesMaster = useLibrary((s) => (target.masterId ? s.details[`series|${target.masterId}`] : undefined));
  useEffect(() => {
    if (target.kind === 'episode' && target.masterId) void stores.library.getState().loadDetails('series', target.masterId);
  }, [target.kind, target.masterId]);
  const seriesVersions = playerSeriesVersions(target, seriesMaster);
  const loadedVersions = useAsync(seriesVersions ? `series-versions:${seriesVersions.map((v) => v.seriesId).join(',')}` : null, () =>
    loadSeriesVersions(api, seriesVersions!),
  );
  const mergedSeries = useMemo(
    () => (loadedVersions.data ? mergeSeriesVersions(loadedVersions.data, target.seriesId) : null),
    [loadedVersions.data, target.seriesId],
  );
  const series = { data: mergedSeries };
  const next = series.data && target.kind === 'episode' ? nextEpisode(series.data, target.streamId) : null;
  const previous = series.data && target.kind === 'episode' ? previousEpisode(series.data, target.streamId) : null;

  // Versions of a movie master for the in-player selector.
  const masterKey = target.kind === 'movie' && target.masterId ? `movies|${target.masterId}` : null;
  const variants = useLibrary((s) => (masterKey ? (s.details[masterKey]?.data?.variants ?? []) : []));
  const revision = useUi((s) => s.libraryRevision);
  useEffect(() => {
    if (target.kind === 'movie' && target.masterId) void stores.library.getState().loadDetails('movies', target.masterId);
  }, [target.kind, target.masterId, revision]);

  const saveProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || isLive || !(video.duration > 0) || target.kind === 'live') return;
    void stores.progress.getState().save(target.kind, target.streamId, {
      title: target.title,
      positionSeconds: video.currentTime,
      durationSeconds: video.duration,
      masterId: target.masterId ?? null,
      seriesId: target.seriesId ?? null,
      seasonNumber: target.seasonNumber ?? null,
      episodeNumber: target.episodeNumber ?? null,
      posterUrl: target.posterUrl ?? null,
      containerExtension: target.container,
    });
  }, [target, isLive]);

  // Load the stream whenever the item changes. The completed download (if any) is read once at start.
  useEffect(() => {
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
    setNextDismissed(false);
    setPanel(null);
    // What the provider sent instead of a video (an error page such as "max connections"), in the log and, when
    // recognised, as the message (D-074; the TV app does the same).
    const explain = () => {
      const url = engine.attempted.at(-1);
      if (!url) return;
      void probeStream(url).then((probe) => {
        if (controller.signal.aborted) return;
        appLog.warn('player', `the provider answered ${describeProbe(probe)}`);
        const text = probeMessage(probeHint(probe));
        if (text) setError(text);
      });
    };
    engine.onFatalError((message) => {
      setError(message);
      setStatus('error');
      explain();
    });

    engine.load({ kind: target.kind, streamId: target.streamId, container: target.container }, offlineRecord, controller.signal).then(
      (loaded) => {
        setSource(loaded);
        setStatus('ready');
        const saved = target.kind === 'live' ? null : findProgress(stores.progress.getState(), target.kind, target.streamId);
        const start = target.startAt ?? resumePosition(saved);
        if (start > 0 && !isLive) video.currentTime = start;
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
        if (!(loadError instanceof PlaybackUnavailableError && loadError.unsupportedFormat)) explain();
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
  }, [target.kind, target.streamId]);

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
    const video = videoRef.current;
    if (video) video.currentTime = clampTime(seconds, video.duration);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      seekTo(video.currentTime + delta);
      setFlash({ side: delta < 0 ? 'back' : 'forward', key: Date.now() });
    },
    [seekTo],
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
    if (next && series.data && target.seriesId) playEpisode(next);
  }, [next, series.data, target.seriesId, playEpisode]);

  const switchVariant = (variant: VariantInfo) => {
    const video = videoRef.current;
    saveProgress();
    chooseVersion(stores, target.masterId!, variant);
    uiStore.getState().replacePlayback({
      ...target,
      streamId: variant.streamId,
      container: variant.containerExtension,
      subtitle: variant.label,
      startAt: video?.currentTime ?? 0,
    });
  };

  const close = useCallback(() => {
    saveProgress();
    if (document.fullscreenElement) void document.exitFullscreen();
    uiStore.getState().stopPlayback();
  }, [saveProgress]);

  // Keyboard shortcuts.
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
            if (!isLive) skip(-SKIP_SECONDS);
            return true;
          case 'ArrowRight':
            if (!isLive) skip(SKIP_SECONDS);
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

  const getPreview = useCallback(() => {
    if (!source || isLive) return null;
    previewRef.current ??= new FrameGrabber(source);
    return previewRef.current;
  }, [source, isLive]);

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
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          setTime(video.currentTime);
          if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
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
          {SKIP_SECONDS}s
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
                <button type="button" className="player__control" onClick={() => skip(-SKIP_SECONDS)} aria-label={t('Back 10 seconds')}>
                  <Icon name="rewind10" size={32} />
                </button>
                <button type="button" className="player__control" onClick={() => skip(SKIP_SECONDS)} aria-label={t('Forward 10 seconds')}>
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
            {series.data ? (
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

      {status === 'loading' ? (
        <div className="player__center">
          <Spinner label={t('Loading stream')} />
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="player__center">
          <div className="player__message" role="alert">
            <p>{error}</p>
            <button type="button" className="button button--primary" onClick={close}>
              {t('Go back')}
            </button>
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
                    seekTo((videoRef.current?.currentTime ?? time) + seconds);
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

      {panel === 'tracks' ? (
        <TracksMenu
          hls={engineRef.current?.hls ?? null}
          video={videoRef.current}
          variants={variants}
          currentStreamId={target.streamId}
          onVariant={switchVariant}
          onSubtitle={(choice) => {
            if (usesPlaybackChoices(target)) rememberPlayback(stores, { subtitles: choice });
          }}
          onAudio={(choice) => {
            if (usesPlaybackChoices(target)) rememberPlayback(stores, { audio: choice });
          }}
          onChange={() => setTracksVersion((v) => v + 1)}
        />
      ) : null}
      {panel === 'episodes' && series.data && target.seriesId ? (
        <EpisodesDrawer series={series.data} currentEpisodeId={target.streamId} onPlay={playEpisode} />
      ) : null}
      {panel === 'guide' && isLive ? (
        <GuidePanel
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
