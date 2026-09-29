import { useEffect, useState } from 'react';
import { type MasterCard, t } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { useHeroTitle, useUi } from '../../hooks/stores';

const TRAILER_DELAY_MS = 3000;

/** Featured movie: backdrop image, then a muted YouTube trailer when the provider has one. See DECISIONS.md#d-025. */
export function Hero({ candidates }: { candidates: MasterCard[] }) {
  const revision = useUi((s) => s.libraryRevision);
  const { featured, meta, play, backdrop } = useHeroTitle(candidates, revision);
  const [showTrailer, setShowTrailer] = useState(false);
  const trailer = meta.data?.trailerYoutubeId;

  useEffect(() => {
    setShowTrailer(false);
    if (!trailer) return;
    const timer = setTimeout(() => setShowTrailer(true), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trailer]);

  if (!featured) return <div style={{ height: 'var(--nav-height)' }} />;

  return (
    <section className="hero" aria-label={t('Featured')}>
      <div className="hero__media">
        {backdrop ? <img src={backdrop} alt="" /> : null}
        {trailer ? (
          <iframe
            className={showTrailer ? 'hero__trailer--visible' : undefined}
            title={t('{title} trailer', { title: featured.title })}
            src={
              showTrailer
                ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(trailer)}&modestbranding=1&playsinline=1`
                : undefined
            }
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
          <button type="button" className="button button--primary" disabled={!play} onClick={() => play && uiStore.getState().play(play)}>
            <Icon name="play" /> {t('Play')}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => uiStore.getState().openDetails({ section: 'movies', masterId: featured.id })}
          >
            <Icon name="info" /> {t('More Info')}
          </button>
        </div>
      </div>
    </section>
  );
}
