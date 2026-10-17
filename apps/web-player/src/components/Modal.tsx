import { useEffect, useRef, type ReactNode } from 'react';
import { uiStore } from '../appContext';
import { Icon } from './Icon';
import { t } from '@iptv/shared';

/** Dialog overlay. Closes on Escape and backdrop click. Focus moves into the panel on open. `fill`: the panel covers the window. */
export function Modal({ label, onClose, fill, children }: { label: string; onClose(): void; fill?: boolean; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // The player sits above modals and handles Escape itself; a dialog over this one closes first.
      const modals = document.querySelectorAll('.modal');
      if (event.key === 'Escape' && !uiStore.getState().playing && modals[modals.length - 1] === panel.current?.parentElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      // A dialog opened over another one leaves the page behind them still.
      document.body.style.overflow = document.querySelector('.modal') ? 'hidden' : '';
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={fill ? 'modal modal--fill' : 'modal'} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panel}>
        <button type="button" className="icon-button modal__close" onClick={onClose} aria-label={t('Close')}>
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>
  );
}
