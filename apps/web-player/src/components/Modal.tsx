import { useEffect, useRef, type ReactNode } from 'react';
import { uiStore } from '../appContext';
import { Icon } from './Icon';

/** Dialog overlay. Closes on Escape and backdrop click. Focus moves into the panel on open. */
export function Modal({ label, onClose, children }: { label: string; onClose(): void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // The player sits above modals and handles Escape itself.
      if (event.key === 'Escape' && !uiStore.getState().playing) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panel}>
        <button type="button" className="icon-button modal__close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>
  );
}
