import { useEffect } from 'react';
import { formatDuration, selectVariant, type MasterDetails, type ProgressDto, type VariantInfo } from '@iptv/shared';
import { api, stores, uiStore } from '../../appContext';
import { DownloadButton } from '../../components/DownloadButton';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useLibrary, useProgress, useUi } from '../../hooks/stores';
import { useAsync } from '../../hooks/useAsync';
import { errorText } from '../../ui/errorText';
import { downloadTarget, movieTarget, progressTarget } from '../../ui/targets';
import type { DetailsTarget } from '../../ui/uiStore';
import { EpisodeList } from './EpisodeList';
import { VariantSelect } from './VariantSelect';

/** Title details: backdrop, metadata, version selector, play/resume, download, episodes. */
export function DetailsModal({ target }: { target: DetailsTarget }) {
  const key = `${target.section}|${target.masterId}`;
  const resource = useLibrary((s) => s.details[key]);
  const revision = useUi((s) => s.libraryRevision);
  const close = () => uiStore.getState().closeDetails();

  useEffect(() => {
    void stores.library.getState().loadDetails(target.section, target.masterId);
  }, [target.section, target.masterId, revision]);

  return (
    <Modal label={resource?.data?.title ?? 'Details'} onClose={close}>
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
    </Modal>
  );
}

/** Latest progress for any variant of this master (or this series), used for "Resume". */
function useMasterProgress(masterId: string, variants: VariantInfo[], kind: 'movie' | 'episode'): ProgressDto | null {
  return useProgress(
    (s) =>
      (s.items.data ?? []).find(
        (p) =>
          p.kind === kind && (p.masterId === masterId || variants.some((v) => v.streamId === (kind === 'movie' ? p.itemId : p.seriesId))),
      ) ?? null,
  );
}

function MovieDetails({ master }: { master: MasterDetails }) {
  const variant = useLibrary((s) => selectVariant(s, master));
  const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
  const resume = useMasterProgress(master.id, master.variants, 'movie');
  useEffect(() => {
    // Resuming a different version than the best one: preselect it so "Resume" continues where the user left off.
    if (resume && master.variants.some((v) => v.streamId === resume.itemId))
      stores.library.getState().selectVariant(master.id, resume.itemId);
  }, [resume?.itemId, master]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!variant) return <p style={{ padding: 32 }}>No playable versions.</p>;

  const play = () => {
    const resumeHere = resume && resume.itemId === variant.streamId ? resume : null;
    uiStore.getState().play({ ...movieTarget(master, variant), startAt: resumeHere ? resumeHere.positionSeconds : undefined });
  };
  const choose = (streamId: string) => stores.library.getState().selectVariant(master.id, streamId);

  const backdrop = meta.data?.backdropUrls[0] ?? meta.data?.summary.posterUrl ?? master.posterUrl;
  const duration = meta.data?.durationSeconds ?? null;

  return (
    <>
      <DetailsHero backdrop={backdrop} title={master.title}>
        <button type="button" className="button button--primary" onClick={play}>
          <Icon name="play" /> {resume && resume.itemId === variant.streamId ? 'Resume' : 'Play'}
        </button>
        <DownloadButton target={downloadTarget(movieTarget(master, variant), duration)} />
      </DetailsHero>
      <div className="details__body">
        <div>
          <Facts year={master.year} rating={meta.data?.summary.rating ?? master.rating} quality={variant.quality} runtime={duration} />
          <p>{meta.data?.plot ?? (meta.loading ? '' : 'No description.')}</p>
          <VariantSelect variants={master.variants} value={variant.streamId} onChange={choose} />
        </div>
        <div className="details__side">
          {meta.data?.cast ? (
            <p>
              Cast: <strong>{meta.data.cast}</strong>
            </p>
          ) : null}
          {meta.data?.genre ? (
            <p>
              Genres: <strong>{meta.data.genre}</strong>
            </p>
          ) : null}
          {meta.data?.director ? (
            <p>
              Director: <strong>{meta.data.director}</strong>
            </p>
          ) : null}
          <p>
            Source: <strong>{variant.rawTitle}</strong>
          </p>
        </div>
      </div>
    </>
  );
}

function SeriesDetailsView({ master }: { master: MasterDetails }) {
  const variant = useLibrary((s) => selectVariant(s, master));
  const series = useAsync(variant ? `series:${variant.streamId}` : null, () => api.catalog.seriesDetails(variant!.streamId));
  const resume = useMasterProgress(master.id, master.variants, 'episode');
  if (!variant) return <p style={{ padding: 32 }}>No playable versions.</p>;

  const firstEpisode = series.data?.seasons[0]?.episodes[0];
  const play = () => {
    if (resume && resume.seriesId === variant.streamId) uiStore.getState().play(progressTarget(resume));
    else if (firstEpisode && series.data) {
      uiStore.getState().play({
        kind: 'episode',
        streamId: firstEpisode.id,
        container: firstEpisode.containerExtension,
        title: master.title,
        subtitle: firstEpisode.title,
        posterUrl: master.posterUrl,
        masterId: master.id,
        seriesId: variant.streamId,
        seasonNumber: firstEpisode.seasonNumber,
        episodeNumber: firstEpisode.episodeNumber,
      });
    }
  };

  return (
    <>
      <DetailsHero backdrop={series.data?.backdropUrls[0] ?? master.posterUrl} title={master.title}>
        <button type="button" className="button button--primary" onClick={play} disabled={!series.data}>
          <Icon name="play" />{' '}
          {resume && resume.seriesId === variant.streamId ? `Resume S${resume.seasonNumber}:E${resume.episodeNumber}` : 'Play'}
        </button>
      </DetailsHero>
      <div className="details__body">
        <div>
          <Facts
            year={master.year}
            rating={master.rating}
            quality={variant.quality}
            extra={series.data ? `${series.data.seasons.length} Season${series.data.seasons.length === 1 ? '' : 's'}` : null}
          />
          <p>{series.data?.summary.plot ?? ''}</p>
          <VariantSelect
            variants={master.variants}
            value={variant.streamId}
            onChange={(streamId) => stores.library.getState().selectVariant(master.id, streamId)}
          />
        </div>
        <div className="details__side">
          {series.data?.cast ? (
            <p>
              Cast: <strong>{series.data.cast}</strong>
            </p>
          ) : null}
          {series.data?.summary.genre ? (
            <p>
              Genres: <strong>{series.data.summary.genre}</strong>
            </p>
          ) : null}
        </div>
      </div>
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
          key={variant.streamId}
          series={series.data}
          title={master.title}
          masterId={master.id}
          seriesId={variant.streamId}
          initialSeason={resume?.seriesId === variant.streamId ? (resume.seasonNumber ?? undefined) : undefined}
        />
      ) : null}
    </>
  );
}

function DetailsHero({ backdrop, title, children }: { backdrop: string | null | undefined; title: string; children: React.ReactNode }) {
  return (
    <div className="details__hero">
      {backdrop ? <img src={backdrop} alt="" /> : null}
      <div className="details__heading">
        <h2 className="details__title">{title}</h2>
        <div className="details__actions">{children}</div>
      </div>
    </div>
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
      {rating != null ? <span className="details__rating">{Math.round(rating * 10)}% rating</span> : null}
      {year ? <span>{year}</span> : null}
      {runtime ? <span>{formatDuration(runtime)}</span> : null}
      {extra ? <span>{extra}</span> : null}
      {quality ? <span className="details__quality">{quality}</span> : null}
    </div>
  );
}
