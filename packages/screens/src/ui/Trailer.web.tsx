import { useEffect, useRef, useState } from 'react';
import { t } from '@iptv/shared';

const TRAILER_DELAY_MS = 3000;
/** A trailer that has not started playing by then (slow network, blocked) is given up; the backdrop stays. */
const START_TIMEOUT_MS = 15_000;
const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * What the YouTube player posts to the page (its IFrame API, `enablejsapi=1`): `playing` once the video plays,
 * `failed` for a removed, private or blocked video (issue #222), null for anything else.
 */
export function trailerEvent(data: unknown): 'playing' | 'failed' | null {
  let message: unknown = data;
  if (typeof data === 'string') {
    try {
      message = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!message || typeof message !== 'object') return null;
  const { event, info } = message as { event?: unknown; info?: unknown };
  if (event === 'onError') return 'failed';
  if (event === 'onStateChange' && info === 1) return 'playing';
  if (event === 'infoDelivery' && info && typeof info === 'object' && (info as { playerState?: unknown }).playerState === 1)
    return 'playing';
  return null;
}

/**
 * Desktop: a muted YouTube trailer over the hero's backdrop (DECISIONS.md#d-025). It loads after a few seconds out of
 * sight and fades in only once YouTube says it plays, so a removed video, no internet or a blocked YouTube leave the
 * backdrop alone instead of YouTube's black "Video unavailable" box (issue #222).
 */
export function Trailer({ youtubeId, title }: { youtubeId: string | null | undefined; title: string }) {
  const [phase, setPhase] = useState<'waiting' | 'loading' | 'playing' | 'failed'>('waiting');
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setPhase('waiting');
    if (!youtubeId) return;
    const timer = setTimeout(() => setPhase('loading'), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [youtubeId]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== YOUTUBE_ORIGIN || event.source !== frame.current?.contentWindow) return;
      const what = trailerEvent(event.data);
      if (what) setPhase(what);
    };
    window.addEventListener('message', onMessage);
    const giveUp = setTimeout(() => setPhase((now) => (now === 'loading' ? 'failed' : now)), START_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(giveUp);
    };
  }, [phase]);

  if (!youtubeId || phase === 'waiting' || phase === 'failed') return null;
  const id = encodeURIComponent(youtubeId);
  const origin = encodeURIComponent(window.location.origin);
  return (
    <iframe
      ref={frame}
      title={t('{title} trailer', { title })}
      src={`${YOUTUBE_ORIGIN}/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&enablejsapi=1&origin=${origin}`}
      // The player posts its state only to a page that asked for it.
      onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), YOUTUBE_ORIGIN)}
      allow="autoplay; encrypted-media"
      tabIndex={-1}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        transform: 'scale(1.35)',
        pointerEvents: 'none',
        opacity: phase === 'playing' ? 1 : 0,
        transition: 'opacity 1s',
      }}
    />
  );
}
