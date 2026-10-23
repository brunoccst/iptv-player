import { useEffect, useState } from 'react';
import { t } from '@iptv/shared';

const TRAILER_DELAY_MS = 3000;

/** Desktop: a muted YouTube trailer that fades in over the hero's backdrop after a few seconds. See DECISIONS.md#d-025. */
export function Trailer({ youtubeId, title }: { youtubeId: string | null | undefined; title: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    if (!youtubeId) return;
    const timer = setTimeout(() => setShown(true), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [youtubeId]);

  if (!youtubeId) return null;
  const id = encodeURIComponent(youtubeId);
  return (
    <iframe
      title={t('{title} trailer', { title })}
      src={
        shown
          ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1`
          : undefined
      }
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
        opacity: shown ? 1 : 0,
        transition: 'opacity 1s',
      }}
    />
  );
}
