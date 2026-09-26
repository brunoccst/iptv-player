import { useState } from 'react';
import { episodeInVersion, findEpisodeProgress, formatDuration, type MergedEpisode, type MergedSeries } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { DownloadButton } from '../../components/DownloadButton';
import { Icon } from '../../components/Icon';
import { useProgress } from '../../hooks/stores';
import { downloadTarget, episodeTarget } from '../../ui/targets';

interface EpisodeListProps {
  /** All versions' episodes, merged (D-066). */
  series: MergedSeries;
  title: string;
  masterId: string;
  /** Versions of the title; with more than one, episodes say which versions have them. */
  versionCount: number;
  initialSeason?: number;
}

export function EpisodeList({ series, title, masterId, versionCount, initialSeason }: EpisodeListProps) {
  const [seasonNumber, setSeasonNumber] = useState(initialSeason ?? series.seasons[0]?.number ?? 1);
  // Per-episode version choice (listed episode id → series id), for this visit of the page.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const season = series.seasons.find((s) => s.number === seasonNumber) ?? series.seasons[0];
  const progress = useProgress((s) => s);
  const context = (episode: MergedEpisode) => ({ title, masterId, seriesId: episode.seriesId, posterUrl: series.summary.posterUrl });

  if (!season) return <p className="episodes muted">No episodes available.</p>;

  return (
    <section className="episodes" aria-label="Episodes">
      <div className="episodes__header">
        <h3>Episodes</h3>
        {series.seasons.length > 1 ? (
          <select className="select" aria-label="Season" value={season.number} onChange={(e) => setSeasonNumber(Number(e.target.value))}>
            {series.seasons.map((s) => (
              <option key={s.number} value={s.number}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted">{season.name}</span>
        )}
      </div>
      {season.episodes.map((listed) => {
        const episode = episodeInVersion(listed, chosen[listed.id]);
        const target = episodeTarget(context(episode), episode);
        const saved = findEpisodeProgress(progress, episode);
        return (
          <div key={listed.id} className="episode">
            <span className="episode__number">{episode.episodeNumber ?? '•'}</span>
            <button
              type="button"
              className="episode__still"
              onClick={() => uiStore.getState().play(target)}
              aria-label={`Play ${episode.title}`}
            >
              {episode.stillUrl ? <img src={episode.stillUrl} alt="" loading="lazy" /> : null}
              {saved && saved.durationSeconds > 0 ? (
                <span className="card__progress">
                  <span style={{ width: `${(saved.positionSeconds / saved.durationSeconds) * 100}%` }} />
                </span>
              ) : null}
            </button>
            <div>
              <p className="episode__title">{episode.title}</p>
              <p className="episode__plot">{[formatDuration(episode.durationSeconds), episode.plot].filter(Boolean).join(' · ')}</p>
              {listed.versions.length > 1 ? (
                <select
                  className="select select--small"
                  aria-label={`Version of ${episode.title}`}
                  value={episode.seriesId}
                  onChange={(e) => setChosen((current) => ({ ...current, [listed.id]: e.target.value }))}
                >
                  {listed.versions.map((v) => (
                    <option key={v.seriesId} value={v.seriesId}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : versionCount > 1 ? (
                <p className="episode__plot">Only in {listed.versions[0]!.label}</p>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="icon-button"
                onClick={() => uiStore.getState().play(target)}
                aria-label={`Play ${episode.title}`}
              >
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
