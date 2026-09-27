import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { createStore } from 'zustand/vanilla';
import { useAppStore, t } from '@iptv/shared';
import { ErrorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts } from '../theme';
import { connectToTv, usePairingServer, type PairingServerState } from './pairing';
import { QrCode } from './QrCode';

/** Open state lives outside the account menu: pairing reloads the app state, which briefly unmounts the screens. */
export const pairingDialog = createStore<{ open: boolean }>(() => ({ open: false }));
const closeDialog = () => pairingDialog.setState({ open: false });

/** Rendered once at the app root: account menu → Sync with phone (TV) or Connect a TV or computer (phone), D-060. */
export function PairingDialogHost() {
  const open = useAppStore(pairingDialog, (s) => s.open);
  if (!open) return null;
  return Platform.isTV ? <SyncWithPhoneDialog onClose={closeDialog} /> : <ConnectTvDialog onClose={closeDialog} />;
}

/** The QR code, or what stands in for it, for a running pairing server (D-060). */
export function PairingCode({ state, size }: { state: PairingServerState; size: number }) {
  switch (state.phase) {
    case 'starting':
      return <ActivityIndicator color={colors.accent} style={{ height: size }} />;
    case 'offline':
      return <Text style={styles.text}>{t('This TV is not connected to a network, so a phone cannot reach it.')}</Text>;
    case 'done':
      return (
        <Text style={styles.text}>
          {state.mode === 'login' ? t('Signed in as {accountName}.', { accountName: state.accountName }) : t('Synced with the phone.')}
        </Text>
      );
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

/** TV: account menu → Sync with phone. Shows the code until a phone with the same account has synced. */
export function SyncWithPhoneDialog({ onClose }: { onClose(): void }) {
  const state = usePairingServer();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="sync-with-phone">
          <Text style={styles.title}>{t('Sync with phone')}</Text>
          <Text style={styles.text}>
            {t(
              'On your phone, open this app → account menu → Connect a TV or computer, and scan the code. Profiles, My List and watch progress are merged on both devices; playback settings stay on each device.',
            )}
          </Text>
          <PairingCode state={state} size={220} />
          <FocusButton
            label={state.phase === 'done' ? t('Done') : t('Close')}
            variant={state.phase === 'done' ? 'primary' : 'ghost'}
            hasTVPreferredFocus
            onPress={onClose}
            testID="sync-with-phone-close"
          />
        </View>
      </View>
    </Modal>
  );
}

/** Phone: account menu → Connect a TV or computer. Opens the scanner at once, then shows the outcome. */
export function ConnectTvDialog({ onClose }: { onClose(): void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    connectToTv()
      .then((text) => {
        if (!active) return;
        if (text === null) onClose();
        else setMessage(text);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [onClose]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="connect-tv">
          <Text style={styles.title}>{t('Connect a TV or computer')}</Text>
          {message ? (
            <Text style={styles.text}>{message}</Text>
          ) : error ? (
            <ErrorText>{error}</ErrorText>
          ) : (
            <>
              <Text style={styles.text}>
                {t('Scan the QR code on the TV: on its sign-in page, or in its account menu → Sync with phone.')}
              </Text>
              <ActivityIndicator color={colors.accent} />
            </>
          )}
          <FocusButton
            label={message ? t('Done') : t('Close')}
            variant={message ? 'primary' : 'ghost'}
            onPress={onClose}
            testID="connect-tv-close"
          />
        </View>
      </View>
    </Modal>
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
