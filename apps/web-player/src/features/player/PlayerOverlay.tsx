import Hls from 'hls.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NEXT_UP_COUNTDOWN_SECONDS, SKIP_SECONDS, clampTime, findProgress, formatClock, introWindow, isInIntro, nextEpisode, nextUpCountdown,
  resumePosition, type VariantInfo,
} from '@iptv/shared';
import { api, downloadsStore, stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/Spinner';
import { useDownloads, useLibrary, useUi } from '../../hooks/stores';
import { useAsync } from '../../hooks/useAsync';
import { selectDownload } from '../../offline/downloadsStore';
import { episodeTarget } from '../../ui/targets';
import type { PlayTarget } from '../../ui/uiStore';
import { EpisodesDrawer } from './EpisodesDrawer';
import { FrameGrabber } from './frameGrabber';
import { NextUp } from './NextUp';
import { PlaybackEngine, type LoadedSource } from './playbackEngine';
import { Timeline } from './Timeline';
import { TracksMenu } from './TracksMenu';

const PROGRESS_SAVE_MS = 10_000;
const IDLE_MS = 3000;

type Status = 'loading' | 'ready' | 'error';

/** Full-screen player. Keyboard: Space/K play, ←/→ ±10 s, ↑/↓ volume, M mute, F fullscreen, Esc close. */
export function PlayerOverlay({ target }: { target: PlayTarget }) {
  const root = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [panel, setPanel] = useState<'tracks' | 'episodes' | null>(null);
  const [nextDismissed, setNextDismissed] = useState(false);
  const [flash, setFlash] = useState<{ side: 'back' | 'forward'; key: number } | null>(null);
  const [, setTracksVersion] = useState(0);

  const offline = useDownloads((s) => (target.kind === 'live' ? null : selectDownload(s, target.kind, target.streamId)));
  const isLive = target.kind === 'live';

  // Series context for the episodes drawer and next-up.
  const series = useAsync(target.seriesId ? `series:${target.seriesId}` : null, () => api.catalog.seriesDetails(target.seriesId!));
  const next = series.data && target.kind === 'episode' ? nextEpisode(series.data, target.streamId) : null;

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
      title: target.title, positionSeconds: video.currentTime, durationSeconds: video.duration, masterId: target.masterId ?? null,
      seriesId: target.seriesId ?? null, seasonNumber: target.seasonNumber ?? null, episodeNumber: target.episodeNumber ?? null,
      posterUrl: target.posterUrl ?? null, containerExtension: target.container,
    });
  }, [target, isLive]);

  // Load the stream whenever the item changes. The completed download (if any) is read once at start.
  useEffect(() => {
    const video = videoRef.current!;
    const engine = new PlaybackEngine(video, api);
    engineRef.current = engine;
    const controller = new AbortController();
    const offlineRecord = target.kind === 'live' ? null : selectDownload(downloadsStore.getState(), target.kind, target.streamId);
    setStatus('loading');
    setError(null);
    setNextDismissed(false);
    setPanel(null);
    engine.onFatalError((message) => {
      setError(message);
      setStatus('error');
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
      },
      (loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        setStatus('error');
      },
    );

    return () => {
      controller.abort();
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

  const skip = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    seekTo(video.currentTime + delta);
    setFlash({ side: delta < 0 ? 'back' : 'forward', key: Date.now() });
  }, [seekTo]);

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

  const playNext = useCallback(() => {
    if (!next || !series.data || !target.seriesId) return;
    saveProgress();
    uiStore.getState().replacePlayback(
      episodeTarget({ title: target.title, masterId: target.masterId, seriesId: target.seriesId, posterUrl: target.posterUrl }, next));
  }, [next, series.data, target, saveProgress]);

  const switchVariant = (variant: VariantInfo) => {
    const video = videoRef.current;
    saveProgress();
    stores.library.getState().selectVariant(target.masterId!, variant.streamId);
    uiStore.getState().replacePlayback({
      ...target, streamId: variant.streamId, container: variant.containerExtension, subtitle: variant.label, startAt: video?.currentTime ?? 0,
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
          case 'Escape':
            if (panel) setPanel(null);
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
    // wake is stable (defined below via ref-free closure over setIdle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlay, skip, toggleFullscreen, close, isLive, panel]);

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

  const intro = introWindow(target.kind, duration);
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

      {flash ? <div key={flash.key} className={`skip-flash skip-flash--${flash.side}`}>{flash.side === 'back' ? '−' : '+'}{SKIP_SECONDS}s</div> : null}

      <div className="player__overlay">
        <div className="player__top">
          <button type="button" className="player__control" onClick={close} aria-label="Back">
            <Icon name="back" size={32} />
          </button>
          <div className="player__heading">
            <h2 className="player__title">{target.title}</h2>
            {target.subtitle ? <p className="player__subtitle">{target.subtitle}{source?.offline ? ' · Downloaded' : ''}</p> : null}
          </div>
          {isLive ? <span className="player__live">LIVE</span> : null}
        </div>

        <div className="player__bottom">
          {!isLive ? <Timeline currentTime={time} duration={duration} bufferedEnd={buffered} onSeek={seekTo} getPreview={getPreview} /> : null}
          <div className="player__controls">
            <button type="button" className="player__control" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              <Icon name={playing ? 'pause' : 'play'} size={36} />
            </button>
            {!isLive ? (
              <>
                <button type="button" className="player__control" onClick={() => skip(-SKIP_SECONDS)} aria-label="Back 10 seconds">
                  <Icon name="rewind10" size={32} />
                </button>
                <button type="button" className="player__control" onClick={() => skip(SKIP_SECONDS)} aria-label="Forward 10 seconds">
                  <Icon name="forward10" size={32} />
                </button>
              </>
            ) : null}
            <button type="button" className="player__control" onClick={() => videoRef.current && (videoRef.current.muted = !muted)}
              aria-label={muted ? 'Unmute' : 'Mute'}>
              <Icon name={muted || volume === 0 ? 'mute' : 'volume'} size={28} />
            </button>
            <input className="player__volume" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
              onChange={(e) => {
                const video = videoRef.current;
                if (video) {
                  video.volume = Number(e.target.value);
                  video.muted = false;
                }
              }} />
            {!isLive ? <span className="player__time">{formatClock(time)} / {formatClock(duration)}</span> : null}
            <span className="spacer" />
            {series.data ? (
              <button type="button" className="player__control" onClick={() => setPanel(panel === 'episodes' ? null : 'episodes')} aria-label="Episodes">
                <Icon name="episodes" size={28} />
              </button>
            ) : null}
            <button type="button" className="player__control" onClick={() => setPanel(panel === 'tracks' ? null : 'tracks')}
              aria-label="Audio, subtitles and version">
              <Icon name="subtitles" size={28} />
            </button>
            <button type="button" className="player__control" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
              <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} size={30} />
            </button>
          </div>
        </div>
      </div>

      {status === 'loading' ? <div className="player__center"><Spinner label="Loading stream" /></div> : null}
      {status === 'error' ? (
        <div className="player__center">
          <div className="player__message" role="alert">
            <p>{error}</p>
            <button type="button" className="button button--primary" onClick={close}>Go back</button>
          </div>
        </div>
      ) : null}

      {status === 'ready' && isInIntro(intro, time) && intro ? (
        <button type="button" className="player__skip-intro" onClick={() => seekTo(intro.end)}>Skip Intro</button>
      ) : null}

      {status === 'ready' && countdown !== null && next ? (
        <NextUp episode={next} secondsLeft={Math.min(countdown, NEXT_UP_COUNTDOWN_SECONDS)} onPlayNow={playNext}
          onDismiss={() => setNextDismissed(true)} />
      ) : null}

      {panel === 'tracks' ? (
        <TracksMenu hls={engineRef.current?.hls ?? null} video={videoRef.current} variants={variants} currentStreamId={target.streamId}
          onVariant={switchVariant} onChange={() => setTracksVersion((v) => v + 1)} />
      ) : null}
      {panel === 'episodes' && series.data && target.seriesId ? (
        <EpisodesDrawer series={series.data} currentEpisodeId={target.streamId} onPlay={(episode) => {
          saveProgress();
          uiStore.getState().replacePlayback(
            episodeTarget({ title: target.title, masterId: target.masterId, seriesId: target.seriesId!, posterUrl: target.posterUrl }, episode));
        }} />
      ) : null}
    </div>
  );
}
