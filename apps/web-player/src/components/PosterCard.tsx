import { useState, type ReactNode } from 'react';
import { t } from '@iptv/shared';
import { menuPosition, type MenuPosition } from './CardMenu';
import { Icon } from './Icon';
import { WatchedTag } from './WatchedTag';

export interface PosterCardProps {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  /** Watch progress 0..1; hidden when undefined. */
  progress?: number;
  /** "Watched" tag at the bottom right of the cover (D-081). */
  watched?: boolean;
  /** On My List: a bookmark at the top right of the cover (issue #157). */
  onList?: boolean;
  landscape?: boolean;
  actions?: ReactNode;
  onSelect(): void;
  /** Right-click (menu key, long touch): the card's options menu (D-079). Without it the browser's own menu shows. */
  onMenu?(position: MenuPosition): void;
}

export function PosterCard({
  title,
  posterUrl,
  subtitle,
  badge,
  progress,
  watched,
  onList,
  landscape,
  actions,
  onSelect,
  onMenu,
}: PosterCardProps) {
  const [failed, setFailed] = useState(false);
  return (
    <article
      className={landscape ? 'card card--landscape' : 'card'}
      onContextMenu={
        onMenu
          ? (event) => {
              event.preventDefault();
              onMenu(menuPosition(event));
            }
          : undefined
      }
    >
      <button type="button" className="card__button" onClick={onSelect} aria-label={title}>
        <div className="card__art">
          {posterUrl && !failed ? (
            <img src={posterUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
          ) : (
            <span className="card__fallback">{title}</span>
          )}
          {badge ? <span className="card__badge">{badge}</span> : null}
          {onList ? (
            <span className="card__mylist" role="img" aria-label={t('On My List')}>
              <Icon name="bookmark" size={16} />
            </span>
          ) : null}
          {watched ? <WatchedTag className="card__watched" /> : null}
          {progress !== undefined ? (
            <span className="card__progress">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          ) : null}
        </div>
        <div className="card__meta">
          <h3 className="card__title">{title}</h3>
          {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        </div>
      </button>
      {actions ? <div className="card__actions">{actions}</div> : null}
    </article>
  );
}
