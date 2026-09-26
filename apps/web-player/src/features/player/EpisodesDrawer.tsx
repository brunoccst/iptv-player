import { useState } from 'react';
import { episodeLabel, type MergedEpisode, type MergedSeries } from '@iptv/shared';

interface EpisodesDrawerProps {
  /** All versions' episodes (D-066). */
  series: MergedSeries;
  currentEpisodeId: string;
  onPlay(episode: MergedEpisode): void;
}

/** In-player episode picker. */
export function EpisodesDrawer({ series, currentEpisodeId, onPlay }: EpisodesDrawerProps) {
  const currentSeason = series.seasons.find((season) => season.episodes.some((e) => e.id === currentEpisodeId))?.number;
  const [seasonNumber, setSeasonNumber] = useState(currentSeason ?? series.seasons[0]?.number ?? 1);
  const season = series.seasons.find((s) => s.number === seasonNumber);

  return (
    <aside className="drawer" aria-label="Episodes">
      <h2>{series.summary.name}</h2>
      {series.seasons.length > 1 ? (
        <select
          className="select"
          aria-label="Season"
          value={seasonNumber}
          onChange={(e) => setSeasonNumber(Number(e.target.value))}
          style={{ marginBottom: 16 }}
        >
          {series.seasons.map((s) => (
            <option key={s.number} value={s.number}>
              {s.name}
            </option>
          ))}
        </select>
      ) : null}
      {season?.episodes.map((episode) => (
        <button
          key={episode.id}
          type="button"
          onClick={() => onPlay(episode)}
          className={`drawer__episode${episode.id === currentEpisodeId ? ' drawer__episode--current' : ''}`}
        >
          {episode.stillUrl ? <img src={episode.stillUrl} alt="" loading="lazy" /> : <span className="drawer__still" />}
          <span>
            <strong>{episodeLabel(episode)}</strong>
            <br />
            <span className="muted">{episode.title}</span>
          </span>
        </button>
      ))}
    </aside>
  );
}
