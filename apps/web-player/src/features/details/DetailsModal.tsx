import { useEffect } from 'react';
import { chooseVersion, setSeriesWatched, formatDuration, type MasterDetails, t, tn } from '@iptv/shared';
import { api, stores, uiStore } from '../../appContext';
import { DownloadButton } from '../../components/DownloadButton';
import { WatchedButton } from '../../components/WatchedButton';
import { WatchlistButton } from '../../components/WatchlistButton';
import { VlcButton } from '../../components/VlcButton';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useLibrary, useMovieDetails, useSeriesDetails, useUi } from '../../hooks/stores';
import { useMediaQuery } from '../../hooks/useMediaQuery';

import { errorText } from '../../ui/errorText';
import { downloadTarget } from '../../ui/targets';
import type { DetailsTarget } from '../../ui/uiStore';
import { DetailsLayout, SPLIT_QUERY, SplitLayout } from './DetailsLayout';
import { EpisodeList } from './EpisodeList';
import { VariantSelect } from './VariantSelect';

/** Title details: backdrop, metadata, version selector, play/resume, download, episodes. */
export function DetailsModal({ target }: { target: DetailsTarget }) {
  const split = useMediaQuery(SPLIT_QUERY);
  const key = `${target.section}|${target.masterId}`;
  const resource = useLibrary((s) => s.details[key]);
  const revision = useUi((s) => s.libraryRevision);
  const close = () => uiStore.getState().closeDetails();

  useEffect(() => {
    void stores.library.getState().loadDetails(target.section, target.masterId);
  }, [target.section, target.masterId, revision]);

  return (
    <Modal label={resource?.data?.title ?? t('Details')} onClose={close} fill={split}>
      <SplitLayout.Provider value={split}>
        {resource?.data ? (
          target.section === 'movies' ? (
            <MovieDetails master={resource.data} />
          ) : (
            <SeriesDetailsView master={resource.data} />
          )
        ) : resource?.status === 'error' ? (
          <p className="error-text" role="alert" style={{ padding: 32 }}>
            {errorText(resource.error)}
          </p>
        ) : (
          <div style={{ padding: 64, display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        )}
      </SplitLayout.Provider>
    </Modal>
  );
}

function MovieDetails({ master }: { master: MasterDetails }) {
  const {
    variant,
    meta,
    watched,
    canResume,
    target,
    play: playTarget,
    backdrop,
    duration,
    rating,
    choose,
    setWatched,
  } = useMovieDetails(master);
  if (!variant || !target || !playTarget) return <p style={{ padding: 32 }}>{t('No playable versions.')}</p>;
  const play = () => uiStore.getState().play(playTarget);

  return (
    <DetailsLayout
      backdrop={backdrop}
      title={master.title}
      watched={watched}
      actions={
        <>
          <button type="button" className="button button--primary" onClick={play}>
            <Icon name="play" /> {canResume ? t('Resume') : t('Play')}
          </button>
          <DownloadButton target={downloadTarget(target, duration)} />
          <WatchedButton kind="movie" watched={watched} onChange={setWatched} />
          <WatchlistButton section="movies" title={master} />
          <VlcButton target={target} />
        </>
      }
      main={
        <>
          <Facts year={master.year} rating={rating} quality={variant.quality} runtime={duration} />
          <p>{meta.data?.plot ?? (meta.loading ? '' : t('No description.'))}</p>
          <VariantSelect variants={master.variants} value={variant.streamId} onChange={choose} />
        </>
      }
      side={
        <>
          {meta.data?.cast ? (
            <p>
              {t('Cast:')} <strong>{meta.data.cast}</strong>
            </p>
          ) : null}
          {meta.data?.genre ? (
            <p>
              {t('Genres:')} <strong>{meta.data.genre}</strong>
            </p>
          ) : null}
          {meta.data?.director ? (
            <p>
              {t('Director:')} <strong>{meta.data.director}</strong>
            </p>
          ) : null}
          <p>
            {t('Source:')} <strong>{variant.rawTitle}</strong>
          </p>
        </>
      }
    />
  );
}

function SeriesDetailsView({ master }: { master: MasterDetails }) {
  // All versions' episode lists merged (D-066); resume; every episode watched (the tag, D-082).
  const { variant, series, allWatched, backdrop, play: playTarget, playLabel, startSeason } = useSeriesDetails(master);
  if (!variant) return <p style={{ padding: 32 }}>{t('No playable versions.')}</p>;
  const play = () => {
    if (playTarget) uiStore.getState().play(playTarget);
  };

  return (
    <DetailsLayout
      backdrop={backdrop}
      title={master.title}
      watched={allWatched}
      actions={
        <>
          <button type="button" className="button button--primary" onClick={play} disabled={!series.data}>
            <Icon name="play" /> {playLabel}
          </button>
          <WatchedButton kind="series" watched={allWatched} onChange={(next) => setSeriesWatched({ api, ...stores }, master.id, next)} />
          <WatchlistButton section="series" title={master} />
        </>
      }
      main={
        <>
          <Facts
            year={master.year}
            rating={master.rating}
            quality={variant.quality}
            extra={series.data ? tn('{count} Season', '{count} Seasons', series.data.seasons.length) : null}
          />
          <p>{series.data?.summary.plot ?? ''}</p>
          <VariantSelect
            variants={master.variants}
            value={variant.streamId}
            onChange={(streamId) => {
              const picked = master.variants.find((v) => v.streamId === streamId);
              if (picked) chooseVersion(stores, master.id, picked);
            }}
          />
        </>
      }
      side={
        <>
          {series.data?.cast ? (
            <p>
              {t('Cast:')} <strong>{series.data.cast}</strong>
            </p>
          ) : null}
          {series.data?.summary.genre ? (
            <p>
              {t('Genres:')} <strong>{series.data.summary.genre}</strong>
            </p>
          ) : null}
        </>
      }
      list={
        <>
          {series.loading ? (
            <div style={{ padding: 32 }}>
              <Spinner />
            </div>
          ) : null}
          {series.error ? (
            <p className="error-text" style={{ padding: '0 32px 32px' }}>
              {errorText(series.error)}
            </p>
          ) : null}
          {series.data ? (
            <EpisodeList
              series={series.data}
              title={master.title}
              masterId={master.id}
              versionCount={master.variants.length}
              initialSeason={startSeason ?? undefined}
            />
          ) : null}
        </>
      }
    />
  );
}

function Facts({
  year,
  rating,
  quality,
  runtime,
  extra,
}: {
  year: number | null;
  rating: number | null | undefined;
  quality: string | null;
  runtime?: number | null;
  extra?: string | null;
}) {
  return (
    <div className="details__facts">
      {rating != null ? <span className="details__rating">{t('{percent}% rating', { percent: Math.round(rating * 10) })}</span> : null}
      {year ? <span>{year}</span> : null}
      {runtime ? <span>{formatDuration(runtime)}</span> : null}
      {extra ? <span>{extra}</span> : null}
      {quality ? <span className="details__quality">{quality}</span> : null}
    </div>
  );
}
