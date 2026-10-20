import { useState } from 'react';
import { episodeLabel, type MergedEpisode, type MergedSeries, t } from '@iptv/shared';

interface EpisodesDrawerProps {
  /** All versions' episodes (D-066). */
  series: MergedSeries;
  currentEpisodeId: string;
  onPlay(episode: MergedEpisode): void;
}

/** In-player episode picker. */
export function EpisodesDrawer({ series, currentEpisodeId, onPlay }: EpisodesDrawerProps) {
  // The episode playing; it may play from another version than the merged list's default one (D-066).
  const isCurrent = (episode: MergedEpisode) =>
    episode.id === currentEpisodeId || episode.versions.some((version) => version.episode.id === currentEpisodeId);
  const currentSeason = series.seasons.find((season) => season.episodes.some(isCurrent))?.number;
  const [seasonNumber, setSeasonNumber] = useState(currentSeason ?? series.seasons[0]?.number ?? 1);
  const season = series.seasons.find((s) => s.number === seasonNumber);

  return (
    <aside className="drawer" aria-label={t('Episodes')}>
      <h2>{series.summary.name}</h2>
      {series.seasons.length > 1 ? (
        <select
          className="select"
          aria-label={t('Season')}
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
      {/* The episode playing is marked and read-only. */}
      {season?.episodes.map((episode) => (
        <button
          key={episode.id}
          type="button"
          onClick={() => onPlay(episode)}
          disabled={isCurrent(episode)}
          aria-current={isCurrent(episode) ? 'true' : undefined}
          className={`drawer__episode${isCurrent(episode) ? ' drawer__episode--current' : ''}`}
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
