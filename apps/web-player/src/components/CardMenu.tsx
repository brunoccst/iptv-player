import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface CardMenuAction {
  label: string;
  onSelect(): void;
}

/** Where a card's menu opens: the pointer for a right-click, the card's corner for the keyboard (D-078, D-079). */
export interface MenuPosition {
  x: number;
  y: number;
}

/**
 * A card's options. On TV they open by holding OK (a panel in the middle, D-078); here they open where you right-click
 * (or with the menu key / Shift+F10, or a long touch where the browser reports it as a context menu). Actions first,
 * then "Cancel". Escape, a click elsewhere, the mouse wheel or leaving the window close it; ↑/↓ move between the items.
 */
export function CardMenu({
  title,
  subtitle,
  actions,
  position,
  onClose,
}: {
  title: string;
  subtitle?: string | null;
  actions: CardMenuAction[];
  position: MenuPosition;
  onClose(): void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState(position);

  // Keep the menu on screen: open to the left/above the pointer near the right/bottom edge.
  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (!box) return;
    const margin = 8;
    setPlace({
      x: Math.max(margin, Math.min(position.x, window.innerWidth - box.width - margin)),
      y: Math.max(margin, Math.min(position.y, window.innerHeight - box.height - margin)),
    });
  }, [position]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    // Scrolling the page yourself closes it; a scroll the page is still finishing (smooth scroll into view) does not.
    window.addEventListener('wheel', onClose, { passive: true });
    window.addEventListener('touchmove', onClose, { passive: true });
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('mousedown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', onClose);
      window.removeEventListener('touchmove', onClose);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
      previous?.focus?.();
    };
  }, [onClose]);

  const moveFocus = (event: ReactKeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Tab') return;
    event.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1;
    items[(index + step + items.length) % items.length]?.focus();
  };

  // On the page itself: inside a card or a row (scaled on hover), a fixed position would be relative to that box.
  return createPortal(
    <div
      ref={menu}
      className="card-menu"
      role="menu"
      aria-label={`Options for ${title}`}
      style={{ left: place.x, top: place.y }}
      onKeyDown={moveFocus}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="card-menu__header">
        <span className="card-menu__title">{title}</span>
        {subtitle ? <span className="card-menu__subtitle">{subtitle}</span> : null}
      </div>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          className="card-menu__item"
          onClick={() => {
            onClose();
            action.onSelect();
          }}
        >
          {action.label}
        </button>
      ))}
      <button type="button" role="menuitem" className="card-menu__item card-menu__item--cancel" onClick={onClose}>
        Cancel
      </button>
    </div>,
    document.body,
  );
}

/** Position for a `contextmenu` event: the pointer, or the element's corner when the keyboard opened it (x = y = 0). */
export function menuPosition(event: { clientX: number; clientY: number; currentTarget: Element }): MenuPosition {
  if (event.clientX || event.clientY) return { x: event.clientX, y: event.clientY };
  const box = event.currentTarget.getBoundingClientRect();
  return { x: box.left + 12, y: box.top + 12 };
}
