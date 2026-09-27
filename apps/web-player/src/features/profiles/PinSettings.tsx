import { useState } from 'react';
import { isValidPin, t } from '@iptv/shared';
import { stores } from '../../appContext';
import { Modal } from '../../components/Modal';
import { usePin } from '../../hooks/stores';
import { pinMessage, PinInput } from './PinDialog';

/** Account menu → Parental PIN: set one (optional), change it, or remove it (D-054). */
export function PinSettings({ onClose }: { onClose(): void }) {
  const hasPin = usePin((s) => s.status === 'set');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const save = async () => {
    if (!isValidPin(next)) return setError(t('The PIN must be 4 digits.'));
    if (next !== confirm) return setError(t('The two new PINs do not match.'));
    const result = await stores.pin.getState().setPin(next, current);
    if (result === 'ok') setDone(hasPin ? t('PIN changed.') : t('PIN set.'));
    else setError(pinMessage(result));
  };
  const remove = async () => {
    const result = await stores.pin.getState().removePin(current);
    if (result === 'ok') setDone(t('PIN removed. Profiles are no longer locked.'));
    else setError(pinMessage(result));
  };

  return (
    <Modal label={t('Parental PIN')} onClose={onClose}>
      <form
        className="profile-editor"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          void save();
        }}
      >
        <h2 style={{ margin: 0 }}>{t('Parental PIN')}</h2>
        {done ? (
          <>
            <p role="status">{done}</p>
            <button type="button" className="button button--primary" onClick={onClose}>
              {t('Close')}
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              {t('Optional. With a PIN, leaving a Kids profile and managing profiles ask for it. Signing out removes it.')}
            </p>
            {hasPin ? <PinInput id="pin-current" label={t('Current PIN')} value={current} onChange={setCurrent} autoFocus /> : null}
            <PinInput
              id="pin-new"
              label={hasPin ? t('New PIN') : t('PIN (4 digits)')}
              value={next}
              onChange={setNext}
              autoFocus={!hasPin}
            />
            <PinInput id="pin-confirm" label={t('Repeat the PIN')} value={confirm} onChange={setConfirm} />
            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" className="button button--primary">
                {hasPin ? t('Change PIN') : t('Set PIN')}
              </button>
              {hasPin ? (
                <button type="button" className="button button--ghost" onClick={() => void remove()}>
                  {t('Remove PIN')}
                </button>
              ) : null}
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
