import { useState } from 'react';
import { findProgress, formatDuration, type SeriesDetails } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { DownloadButton } from '../../components/DownloadButton';
import { Icon } from '../../components/Icon';
import { useProgress } from '../../hooks/stores';
import { downloadTarget, episodeTarget } from '../../ui/targets';

interface EpisodeListProps {
  series: SeriesDetails;
  title: string;
  masterId: string;
  seriesId: string;
  initialSeason?: number;
}

export function EpisodeList({ series, title, masterId, seriesId, initialSeason }: EpisodeListProps) {
  const [seasonNumber, setSeasonNumber] = useState(initialSeason ?? series.seasons[0]?.number ?? 1);
  const season = series.seasons.find((s) => s.number === seasonNumber) ?? series.seasons[0];
  const progress = useProgress((s) => s);
  const context = { title, masterId, seriesId, posterUrl: series.summary.posterUrl };

  if (!season) return <p className="episodes muted">No episodes available.</p>;

  return (
    <section className="episodes" aria-label="Episodes">
      <div className="episodes__header">
        <h3>Episodes</h3>
        {series.seasons.length > 1 ? (
          <select className="select" aria-label="Season" value={season.number} onChange={(e) => setSeasonNumber(Number(e.target.value))}>
            {series.seasons.map((s) => <option key={s.number} value={s.number}>{s.name}</option>)}
          </select>
        ) : <span className="muted">{season.name}</span>}
      </div>
      {season.episodes.map((episode) => {
        const target = episodeTarget(context, episode);
        const saved = findProgress(progress, 'episode', episode.id);
        return (
          <div key={episode.id} className="episode">
            <span className="episode__number">{episode.episodeNumber ?? '•'}</span>
            <button type="button" className="episode__still" onClick={() => uiStore.getState().play(target)} aria-label={`Play ${episode.title}`}>
              {episode.stillUrl ? <img src={episode.stillUrl} alt="" loading="lazy" /> : null}
              {saved && saved.durationSeconds > 0 ? (
                <span className="card__progress"><span style={{ width: `${(saved.positionSeconds / saved.durationSeconds) * 100}%` }} /></span>
              ) : null}
            </button>
            <div>
              <p className="episode__title">{episode.title}</p>
              <p className="episode__plot">{[formatDuration(episode.durationSeconds), episode.plot].filter(Boolean).join(' · ')}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="icon-button" onClick={() => uiStore.getState().play(target)} aria-label={`Play ${episode.title}`}>
                <Icon name="play" size={20} />
              </button>
              <DownloadButton target={downloadTarget(target, episode.durationSeconds)} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
