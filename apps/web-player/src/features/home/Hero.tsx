import { useEffect, useMemo, useState } from 'react';
import { selectVariant, type MasterCard } from '@iptv/shared';
import { api, stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { useLibrary, useUi } from '../../hooks/stores';
import { useAsync } from '../../hooks/useAsync';
import { movieTarget } from '../../ui/targets';

const TRAILER_DELAY_MS = 3000;

/** Featured movie: backdrop image, then a muted YouTube trailer when the provider has one. See DECISIONS.md#d-025. */
export function Hero({ candidates }: { candidates: MasterCard[] }) {
  const featured = useMemo(() => {
    const withArt = candidates.filter((item) => item.posterUrl);
    return withArt[Math.floor(Math.random() * withArt.length)] ?? candidates[0] ?? null;
  }, [candidates]);

  const revision = useUi((s) => s.libraryRevision);
  useEffect(() => {
    if (featured) void stores.library.getState().loadDetails('movies', featured.id);
  }, [featured, revision]);

  const details = useLibrary((s) => (featured ? (s.details[`movies|${featured.id}`]?.data ?? null) : null));
  const variant = useLibrary((s) => (details ? selectVariant(s, details) : null));
  const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
  const [showTrailer, setShowTrailer] = useState(false);
  const trailer = meta.data?.trailerYoutubeId;

  useEffect(() => {
    setShowTrailer(false);
    if (!trailer) return;
    const timer = setTimeout(() => setShowTrailer(true), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trailer]);

  if (!featured) return <div style={{ height: 'var(--nav-height)' }} />;
  const backdrop = meta.data?.backdropUrls[0] ?? featured.posterUrl;

  return (
    <section className="hero" aria-label="Featured">
      <div className="hero__media">
        {backdrop ? <img src={backdrop} alt="" /> : null}
        {trailer ? (
          <iframe
            className={showTrailer ? 'hero__trailer--visible' : undefined}
            title={`${featured.title} trailer`}
            src={showTrailer ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(trailer)}&modestbranding=1&playsinline=1` : undefined}
            allow="autoplay; encrypted-media"
            tabIndex={-1}
          />
        ) : null}
      </div>
      <div className="hero__shade" />
      <div className="hero__content">
        <h1 className="hero__title">{featured.title}</h1>
        {meta.data?.plot ? <p className="hero__plot">{meta.data.plot}</p> : null}
        <div className="hero__actions">
          <button type="button" className="button button--primary" disabled={!details || !variant}
            onClick={() => details && variant && uiStore.getState().play(movieTarget(details, variant))}>
            <Icon name="play" /> Play
          </button>
          <button type="button" className="button button--secondary"
            onClick={() => uiStore.getState().openDetails({ section: 'movies', masterId: featured.id })}>
            <Icon name="info" /> More Info
          </button>
        </div>
      </div>
    </section>
  );
}
