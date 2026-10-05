import { useCallback, useState } from 'react';
import {
  episodeLabel,
  episodeMenuItems,
  isEpisodeWatched,
  isSeasonWatched,
  setEpisodeWatched,
  setSeasonWatched,
  episodeInVersion,
  findEpisodeProgress,
  formatDuration,
  isWatched,
  type EpisodeMenuItemId,
  type MergedEpisode,
  type MergedSeries,
  type PlayTarget,
  t,
} from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { CardMenu, menuBelow, menuPosition, type MenuPosition } from '../../components/CardMenu';
import { useDownload } from '../../components/DownloadButton';
import { Icon } from '../../components/Icon';
import { WatchedButton } from '../../components/WatchedButton';
import { WatchedTag } from '../../components/WatchedTag';
import { useVlc } from '../../components/VlcButton';
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
  // The episode's menu (D-083): its "…" button, or a right-click on the episode.
  const [menu, setMenu] = useState<{ episode: MergedEpisode; position: MenuPosition } | null>(null);
  // Stable, so the open menu keeps its focus while a download's progress redraws the list.
  const closeMenu = useCallback(() => setMenu(null), []);

  if (!season) return <p className="episodes muted">{t('No episodes available.')}</p>;

  return (
    <section className="episodes" aria-label={t('Episodes')}>
      <div className="episodes__header">
        <h3>{t('Episodes')}</h3>
        {/* Watched on the left of the season choice, like an episode's tag; spaced like the other icons (issue #159). */}
        <div className="episodes__season">
          {/* Only this season (issue #132). */}
          <WatchedButton
            kind="season"
            watched={isSeasonWatched(progress, season)}
            onChange={(next) => setSeasonWatched(stores.progress, season, context(season.episodes[0]!), next)}
            testID="season-watched-toggle"
          />
          {series.seasons.length > 1 ? (
            <select
              className="select"
              aria-label={t('Season')}
              value={season.number}
              onChange={(e) => setSeasonNumber(Number(e.target.value))}
            >
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
      </div>
      {season.episodes.map((listed) => {
        const episode = episodeInVersion(listed, chosen[listed.id]);
        const target = episodeTarget(context(episode), episode);
        const saved = findEpisodeProgress(progress, episode);
        return (
          <div
            key={listed.id}
            className="episode"
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu({ episode, position: menuPosition(event) });
            }}
          >
            <span className="episode__number">{episode.episodeNumber ?? '•'}</span>
            <button
              type="button"
              className="episode__still"
              onClick={() => uiStore.getState().play(target)}
              aria-label={t('Play {title}', { title: episode.title })}
            >
              {episode.stillUrl ? <img src={episode.stillUrl} alt="" loading="lazy" /> : null}
              {isWatched(saved) ? (
                <WatchedTag className="card__watched" />
              ) : saved && saved.durationSeconds > 0 ? (
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
                  aria-label={t('Version of {title}', { title: episode.title })}
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
                <p className="episode__plot">{t('Only in {label}', { label: listed.versions[0]!.label })}</p>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="icon-button"
                onClick={() => uiStore.getState().play(target)}
                aria-label={t('Play {title}', { title: episode.title })}
              >
                <Icon name="play" size={20} />
              </button>
              {/* Everything else is in the episode's menu, so the row stays short (D-083). */}
              <button
                type="button"
                className="icon-button"
                aria-label={t('More options for {title}', { title: episode.title })}
                aria-haspopup="menu"
                title={t('More options')}
                onClick={(event) => setMenu({ episode, position: menuBelow(event.currentTarget) })}
              >
                <Icon name="more" size={20} />
              </button>
            </div>
          </div>
        );
      })}
      {menu ? (
        <EpisodeMenu
          episode={menu.episode}
          target={episodeTarget(context(menu.episode), menu.episode)}
          position={menu.position}
          watched={isEpisodeWatched(progress, menu.episode)}
          onWatched={(watched) => void setEpisodeWatched(stores.progress, menu.episode, context(menu.episode), watched)}
          onClose={closeMenu}
        />
      ) : null}
    </section>
  );
}

/** An episode's options (D-083): Mark as (not) watched, Download, Open in VLC (desktop app). */
function EpisodeMenu({
  episode,
  target,
  position,
  watched,
  onWatched,
  onClose,
}: {
  episode: MergedEpisode;
  target: PlayTarget;
  position: MenuPosition;
  watched: boolean;
  onWatched(watched: boolean): void;
  onClose(): void;
}) {
  const download = useDownload(downloadTarget(target, episode.durationSeconds));
  const vlc = useVlc();
  const run: Record<EpisodeMenuItemId, () => void> = {
    watched: () => onWatched(true),
    unwatched: () => onWatched(false),
    download: () => download?.toggle(),
    'play-on-tv': () => undefined,
    external: () => vlc?.(target),
  };
  return (
    <CardMenu
      title={episode.title}
      subtitle={episodeLabel(episode)}
      position={position}
      onClose={onClose}
      actions={episodeMenuItems({ watched, download: download?.menu, externalPlayer: vlc ? 'vlc' : null }).map((item) => ({
        label: item.label,
        disabled: item.disabled,
        icon: item.icon,
        onSelect: run[item.id],
      }))}
    />
  );
}
