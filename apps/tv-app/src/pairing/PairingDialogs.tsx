import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { createStore } from 'zustand/vanilla';
import { useAppStore, t } from '@iptv/shared';
import { ErrorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts } from '../theme';
import { canScanQr, connectToDevice, usePairingServer, type PairingServerState } from './pairing';
import { QrCode } from './QrCode';

/** Open state lives outside the account menu: pairing reloads the app state, which briefly unmounts the screens. */
export const pairingDialog = createStore<{ open: boolean; view: SyncView }>(() => ({ open: false, view: 'code' }));
type SyncView = 'code' | 'scan';
/** Account menu → Sync with another device shows this device's code; the sign-in page's Scan a code opens the scanner. */
export const openPairingDialog = (view: SyncView = 'code') => pairingDialog.setState({ open: true, view });
const closeDialog = () => pairingDialog.setState({ open: false });

/** Rendered once at the app root (D-060, D-178). */
export function PairingDialogHost() {
  const open = useAppStore(pairingDialog, (s) => s.open);
  const view = useAppStore(pairingDialog, (s) => s.view);
  if (!open) return null;
  return <SyncDialog initialView={view} onClose={closeDialog} />;
}

/** The QR code, or what stands in for it, for a running pairing server (D-060). */
export function PairingCode({ state, size }: { state: PairingServerState; size: number }) {
  switch (state.phase) {
    case 'starting':
      return <ActivityIndicator color={colors.accent} style={{ height: size }} />;
    case 'offline':
      return <Text style={styles.text}>{t('This device is not connected to a network, so other devices cannot reach it.')}</Text>;
    case 'done':
      return <Text style={styles.text}>{pairingDoneText(state)}</Text>;
    default:
      return (
        <View style={styles.code}>
          <QrCode text={state.qr} size={size} testID="pairing-qr" />
          {state.phase === 'working' ? <Text style={styles.hint}>{t('Connecting…')}</Text> : null}
          {state.phase === 'ready' && state.error ? <ErrorText>{state.error}</ErrorText> : null}
        </View>
      );
  }
}

export function pairingDoneText(state: Extract<PairingServerState, { phase: 'done' }>) {
  switch (state.mode) {
    case 'login':
      return t('Signed in as {accountName}.', { accountName: state.accountName });
    case 'share':
      return t('The other device is now signed in as {accountName}.', { accountName: state.accountName });
    case 'sync':
      return t('Synced with the other device.');
  }
}

/**
 * Account menu → Sync with another device (D-060, D-178): this device's code for another device to scan, and on
 * devices with a camera, Scan a code to read another device's code instead.
 */
export function SyncDialog({ initialView, onClose }: { initialView: SyncView; onClose(): void }) {
  const [view, setView] = useState<SyncView>(initialView);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="sync-devices">
          <Text style={styles.title}>{t('Sync with another device')}</Text>
          {view === 'code' ? (
            <ShowCode onScan={() => setView('scan')} onClose={onClose} />
          ) : (
            // A cancelled scan goes back to this device's code, or closes when the scanner was all that was asked for.
            <ScanCode onCancel={initialView === 'code' ? () => setView('code') : onClose} onClose={onClose} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function ShowCode({ onScan, onClose }: { onScan(): void; onClose(): void }) {
  const state = usePairingServer();
  const done = state.phase === 'done';
  return (
    <>
      <Text style={styles.text}>
        {t(
          'Scan this code with the app on another phone or tablet: account menu → Sync with another device → Scan a code. Profiles, My List and watch progress are merged on both devices; playback settings stay on each device.',
        )}
      </Text>
      <PairingCode state={state} size={220} />
      {!done && canScanQr() ? <FocusButton label={t('Scan a code instead')} variant="ghost" onPress={onScan} testID="sync-scan" /> : null}
      <FocusButton
        label={done ? t('Done') : t('Close')}
        variant={done ? 'primary' : 'ghost'}
        hasTVPreferredFocus
        onPress={onClose}
        testID="sync-close"
      />
    </>
  );
}

/** Opens the scanner at once, then shows the outcome. */
function ScanCode({ onCancel, onClose }: { onCancel(): void; onClose(): void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One scan per mount, whatever the parent redraws.
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    let active = true;
    connectToDevice()
      .then((text) => {
        if (!active) return;
        if (text === null) cancel.current();
        else setMessage(text);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      {message ? (
        <Text style={styles.text}>{message}</Text>
      ) : error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        <>
          <Text style={styles.text}>
            {t('Scan the QR code on the other device: on its sign-in page, or in its account menu → Sync with another device.')}
          </Text>
          <ActivityIndicator color={colors.accent} />
        </>
      )}
      <FocusButton
        label={message ? t('Done') : t('Close')}
        variant={message ? 'primary' : 'ghost'}
        hasTVPreferredFocus
        onPress={onClose}
        testID="sync-close"
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 440,
    maxWidth: '100%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  text: { color: colors.text, fontSize: fonts.small },
  hint: { color: colors.muted, fontSize: fonts.tiny },
  code: { alignItems: 'center', gap: 8 },
});
