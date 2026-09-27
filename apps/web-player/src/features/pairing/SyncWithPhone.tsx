import { createStore } from 'zustand/vanilla';
import { useAppStore } from '@iptv/shared';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { usePairingServer, type PairingServerState } from './pairing';
import { QrCode } from './QrCode';

const HOW_TO =
  'On your phone, open this app → account menu → Connect a TV or computer, and scan the code. Phone and computer must be on the same home network; if Windows asks, allow the app on private networks.';

/** The QR code, or what stands in for it (D-072). */
export function PairingCode({ state, size = 240 }: { state: PairingServerState; size?: number }) {
  switch (state.phase) {
    case 'starting':
      return <Spinner label="Preparing the code" />;
    case 'offline':
      return <p className="error-text">This computer is not connected to a home network, so a phone cannot reach it.</p>;
    case 'done':
      return <p>{state.mode === 'login' ? `Signed in as ${state.accountName}.` : 'Synced with the phone.'}</p>;
    default:
      return (
        <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
          <QrCode text={state.qr} size={size} />
          {state.phase === 'working' ? <p className="muted">Connecting…</p> : null}
          {state.phase === 'ready' && state.error ? (
            <p className="error-text" role="alert">
              {state.error}
            </p>
          ) : null}
        </div>
      );
  }
}

/** Open state outside the screens: pairing reloads the app state, which briefly unmounts them (as on the TV). */
const pairingDialog = createStore<{ open: boolean }>()(() => ({ open: false }));
export const openSyncWithPhone = () => pairingDialog.setState({ open: true });
const closeSyncWithPhone = () => pairingDialog.setState({ open: false });

/** Rendered once at the app root. */
export function SyncWithPhoneHost() {
  const open = useAppStore(pairingDialog, (s) => s.open);
  return open ? <SyncWithPhone onClose={closeSyncWithPhone} /> : null;
}

/**
 * Desktop app: account menu → Sync with phone (D-072): profiles, My List and progress are merged with the phone's.
 * The login page shows the same code beside the form, to sign in.
 */
export function SyncWithPhone({ onClose }: { onClose(): void }) {
  const state = usePairingServer();
  const title = 'Sync with phone';
  return (
    <Modal label={title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {HOW_TO} Profiles, My List and watch progress end up the same on both devices.
        </p>
        <PairingCode state={state} />
        <button type="button" className={state.phase === 'done' ? 'button button--accent' : 'button button--ghost'} onClick={onClose}>
          {state.phase === 'done' ? 'Done' : 'Close'}
        </button>
      </div>
    </Modal>
  );
}
