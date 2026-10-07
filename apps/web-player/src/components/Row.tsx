import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Spinner } from './Spinner';
import { t } from '@iptv/shared';

interface RowProps {
  title: string;
  children: ReactNode;
  /** Called once when the row scrolls near the viewport (lazy data loading). */
  onVisible?: () => void;
  empty?: ReactNode;
  /** Makes the title a link ("Drama ›"), e.g. to the whole category. */
  onTitleClick?: () => void;
  /** Called when the track is scrolled near its end (load the next page). */
  onNearEnd?: () => void;
  /** Shows a spinner after the last card. */
  loadingMore?: boolean;
}

/** Horizontal scrolling row with arrow buttons; each arrow is hidden while the row is at that end (D-159). */
export function Row({ title, children, onVisible, empty, onTitleClick, onNearEnd, loadingMore }: RowProps) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(!onVisible);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const updateEnds = () => {
    const element = track.current;
    if (!element) return;
    // 1 px of slack: zoomed screens report fractional scroll positions.
    setAtStart(element.scrollLeft <= 1);
    setAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 1);
  };

  useEffect(() => {
    if (seen || !root.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [seen]);

  useEffect(() => {
    if (seen) onVisible?.();
    // onVisible is intentionally read once when the row becomes visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  // The ends change when cards are added (next page) or the window is resized.
  useEffect(updateEnds);
  useEffect(() => {
    const element = track.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateEnds);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasChildren]);

  const scroll = (direction: 1 | -1) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.8 });
  };

  return (
    <section className="row" ref={root} aria-label={title}>
      <h2 className="row__title">
        {onTitleClick ? (
          <button type="button" className="row__link" onClick={onTitleClick} aria-label={t('Open {title}', { title })}>
            {title} <Icon name="chevronRight" size={18} />
          </button>
        ) : (
          title
        )}
      </h2>
      {hasChildren ? (
        <div className="row__viewport">
          {atStart ? null : (
            <button
              type="button"
              className="row__arrow row__arrow--left"
              onClick={() => scroll(-1)}
              aria-label={t('Scroll {title} left', { title })}
            >
              <Icon name="chevronLeft" size={36} />
            </button>
          )}
          <div
            className="row__track"
            ref={track}
            onScroll={(event) => {
              const element = event.currentTarget;
              updateEnds();
              if (onNearEnd && element.scrollLeft + element.clientWidth >= element.scrollWidth - element.clientWidth) onNearEnd();
            }}
          >
            {children}
            {loadingMore ? (
              <div className="row__more">
                <Spinner small label={t('Loading more')} />
              </div>
            ) : null}
          </div>
          {atEnd ? null : (
            <button
              type="button"
              className="row__arrow row__arrow--right"
              onClick={() => scroll(1)}
              aria-label={t('Scroll {title} right', { title })}
            >
              <Icon name="chevronRight" size={36} />
            </button>
          )}
        </div>
      ) : (
        <div className="row__empty muted">{empty}</div>
      )}
    </section>
  );
}
