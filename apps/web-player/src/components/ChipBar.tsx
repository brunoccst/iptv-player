import { useEffect, useLayoutEffect, useRef, useState, type WheelEvent } from 'react';
import { t } from '@iptv/shared';
import { Icon } from './Icon';

export interface ChipItem {
  key: string;
  label: string;
  active: boolean;
  onSelect(): void;
}

/**
 * Category chips on one line, like the TV and phone apps (D-085). When they do not fit, "Show all" wraps every chip
 * across the width and "Show less" returns to the line; picking a chip also returns to it, with the chosen chip in
 * view. On the line, the mouse wheel scrolls sideways.
 */
export function ChipBar({ chips, label }: { chips: ChipItem[]; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const line = useRef<HTMLDivElement>(null);

  // Whether the chips fit on the line: measured again when the window or the list changes.
  useLayoutEffect(() => {
    const element = line.current;
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [chips.length, expanded]);

  // On the line, the chosen chip is in view (after opening a category from Home, or after "Show less").
  const activeKey = chips.find((chip) => chip.active)?.key;
  useEffect(() => {
    if (expanded) return;
    const active = line.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (active && line.current) line.current.scrollLeft = Math.max(0, active.offsetLeft - line.current.offsetLeft - 24);
  }, [activeKey, expanded]);

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const element = line.current;
    if (!element || expanded || !overflows || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    element.scrollLeft += event.deltaY;
  };

  return (
    <div className={`chip-bar${expanded ? ' chip-bar--expanded' : ''}`}>
      <div className="chips chip-bar__chips" role="tablist" aria-label={label} ref={line} onWheel={onWheel}>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={chip.active}
            className={`chip${chip.active ? ' chip--active' : ''}`}
            onClick={() => {
              setExpanded(false);
              chip.onSelect();
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {expanded || overflows ? (
        <button
          type="button"
          className="chip chip-bar__toggle"
          aria-expanded={expanded}
          aria-label={expanded ? t('Show fewer categories') : t('Show all categories')}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('Show less') : t('Show all')}
          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} />
        </button>
      ) : null}
    </div>
  );
}
