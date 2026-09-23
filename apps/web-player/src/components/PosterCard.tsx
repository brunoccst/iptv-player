import { useState, type ReactNode } from 'react';

export interface PosterCardProps {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  /** Watch progress 0..1; hidden when undefined. */
  progress?: number;
  landscape?: boolean;
  actions?: ReactNode;
  onSelect(): void;
}

export function PosterCard({ title, posterUrl, subtitle, badge, progress, landscape, actions, onSelect }: PosterCardProps) {
  const [failed, setFailed] = useState(false);
  return (
    <article className={landscape ? 'card card--landscape' : 'card'}>
      <button type="button" className="card__button" onClick={onSelect} aria-label={title}>
        <div className="card__art">
          {posterUrl && !failed ? (
            <img src={posterUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
          ) : (
            <span className="card__fallback">{title}</span>
          )}
          {badge ? <span className="card__badge">{badge}</span> : null}
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
