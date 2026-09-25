import { useState, type ReactNode } from 'react';
import { PIN_LENGTH, type PinResult } from '@iptv/shared';
import { stores } from '../../appContext';
import { Modal } from '../../components/Modal';

export const pinMessage = (result: PinResult) =>
  result === 'locked' ? 'Too many wrong tries. Try again in a minute.' : result === 'wrong' ? 'Wrong PIN.' : null;

/** Asks for the parental PIN (D-054). `onSuccess` runs once `submit` accepts it. */
export function PinDialog({
  title,
  submit = (pin) => stores.pin.getState().verify(pin),
  onSuccess,
  onClose,
}: {
  title: string;
  submit?(pin: string): Promise<PinResult>;
  onSuccess(): void;
  onClose(): void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal label={title} onClose={onClose}>
      <form
        className="profile-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await submit(pin);
          if (result === 'ok') onSuccess();
          else {
            setPin('');
            setError(pinMessage(result));
          }
        }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        <PinInput id="pin" label="Parental PIN" value={pin} onChange={setPin} autoFocus />
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="button button--primary" disabled={pin.length !== PIN_LENGTH}>
          OK
        </button>
      </form>
    </Modal>
  );
}

export function PinInput({
  id,
  label,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange(value: string): void;
  autoFocus?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        autoFocus={autoFocus}
      />
    </div>
  );
}

/** Runs an action directly, or after the PIN when `needed`. Render `dialog` somewhere in the component. */
export function usePinGate() {
  const [pending, setPending] = useState<{ title: string; action(): void } | null>(null);
  const gate = (needed: boolean, title: string, action: () => void) => (needed ? setPending({ title, action }) : action());
  const dialog = pending ? (
    <PinDialog
      title={pending.title}
      onSuccess={() => {
        setPending(null);
        pending.action();
      }}
      onClose={() => setPending(null)}
    />
  ) : null;
  return { gate, dialog };
}
