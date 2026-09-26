import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { updater } from '../appContext';
import { ErrorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts } from '../theme';

const installedVersion = () => {
  try {
    return TvMedia.installedVersion().versionCode;
  } catch {
    return null;
  }
};

/** Rendered once at the app root: the update prompt and its progress (D-062). */
export function UpdateDialog() {
  const prompt = useAppStore(updater.store, (s) => s.prompt);
  const status = useAppStore(updater.store, (s) => s.status);
  if (!prompt || status.phase === 'idle') return null;
  const current = installedVersion();
  const close = updater.dismiss;

  let body;
  switch (status.phase) {
    case 'checking':
      body = (
        <>
          <Text style={styles.text}>Checking for updates…</Text>
          <ActivityIndicator color={colors.accent} />
        </>
      );
      break;
    case 'current':
      body = (
        <>
          <Text style={styles.text}>No update available: you have the newest version{current ? ` (${current})` : ''}.</Text>
          <FocusButton label="OK" variant="primary" hasTVPreferredFocus onPress={close} testID="update-close" />
        </>
      );
      break;
    case 'available':
      body = (
        <>
          <Text style={styles.text}>
            Version {status.release.versionCode} is available{current ? ` (you have ${current})` : ''}. The app downloads it and Android
            asks you to confirm the installation. Your data stays.
          </Text>
          <FocusButton
            label="Update now"
            variant="primary"
            hasTVPreferredFocus
            onPress={() => void updater.install(status.release)}
            testID="update-install"
          />
          <FocusButton label="Later" variant="ghost" onPress={() => void updater.later()} testID="update-later" />
        </>
      );
      break;
    case 'downloading':
      body = (
        <>
          <Text style={styles.text}>
            Downloading version {status.release.versionCode}…{status.progress !== null ? ` ${Math.floor(status.progress * 100)}%` : ''}
          </Text>
          <View style={styles.track}>
            <View style={[styles.value, { width: `${Math.round((status.progress ?? 0) * 100)}%` }]} />
          </View>
        </>
      );
      break;
    case 'installing':
      body = (
        <>
          <Text style={styles.text}>Android asks you to confirm the installation. The app restarts with the new version.</Text>
          <FocusButton label="Close" variant="ghost" hasTVPreferredFocus onPress={close} testID="update-close" />
        </>
      );
      break;
    case 'permission':
      body = (
        <>
          <Text style={styles.text}>
            Android needs your permission for this app to install updates. In the screen that opens, turn on “Allow from this source”, come
            back, then choose Update now.
          </Text>
          <FocusButton
            label="Open settings"
            variant="primary"
            hasTVPreferredFocus
            onPress={() => {
              try {
                TvMedia.openInstallSettings();
              } catch {
                // No settings screen to open; the text above still explains what to allow.
              }
            }}
            testID="update-settings"
          />
          <FocusButton label="Update now" onPress={() => void updater.install(status.release)} testID="update-install" />
          <FocusButton label="Close" variant="ghost" onPress={close} testID="update-close" />
        </>
      );
      break;
    case 'failed':
      body = (
        <>
          <ErrorText>{status.message}</ErrorText>
          <FocusButton
            label="Try again"
            variant="primary"
            hasTVPreferredFocus
            onPress={() => void (status.release ? updater.install(status.release) : updater.check())}
            testID="update-retry"
          />
          <FocusButton label="Close" variant="ghost" onPress={close} testID="update-close" />
        </>
      );
      break;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="update-dialog">
          <Text style={styles.title}>App update</Text>
          {body}
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
  track: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  value: { height: 4, backgroundColor: colors.accent },
});
