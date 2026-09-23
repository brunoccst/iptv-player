import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface RowProps {
  title: string;
  children: ReactNode;
  /** Called once when the row scrolls near the viewport (lazy data loading). */
  onVisible?: () => void;
  empty?: ReactNode;
}

/** Horizontal scrolling row with arrow buttons. */
export function Row({ title, children, onVisible, empty }: RowProps) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(!onVisible);

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

  const scroll = (direction: 1 | -1) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.8 });
  };

  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  return (
    <section className="row" ref={root} aria-label={title}>
      <h2 className="row__title">{title}</h2>
      {hasChildren ? (
        <div className="row__viewport">
          <button type="button" className="row__arrow row__arrow--left" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}>
            <Icon name="chevronLeft" size={36} />
          </button>
          <div className="row__track" ref={track}>
            {children}
          </div>
          <button type="button" className="row__arrow row__arrow--right" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}>
            <Icon name="chevronRight" size={36} />
          </button>
        </div>
      ) : (
        <div className="row__empty muted">{empty}</div>
      )}
    </section>
  );
}
