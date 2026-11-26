import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createMemoryStorage, t, useAppStore } from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { updateRepo } from '../config';
import { createUpdater, shortVersion } from '../update/updates';

/**
 * "The app could not start" (D-251): shown instead of the app when loading or drawing it throws. It uses the update
 * code only (TvMedia, fetch, `t`), never `appContext`, so it works when the rest of the app is what is broken. The
 * same release and installer as App updates (D-062): Update now downloads the newest APK and opens Android's installer.
 */
const updater = createUpdater({ repo: updateRepo, storage: createMemoryStorage() });

function StartButton({
  label,
  onPress,
  primary,
  preferred,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  preferred?: boolean;
  testID: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      hasTVPreferredFocus={preferred}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      testID={testID}
      style={[styles.button, primary && styles.primary, focused && styles.focused]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function StartFailedScreen({ error }: { error: unknown }) {
  const status = useAppStore(updater.store, (s) => s.status);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    void updater.check(true).then(() => setChecked(true));
  }, []);
  const detail = String((error as Error | undefined)?.stack ?? (error as Error | undefined)?.message ?? error).slice(0, 1500);
  const install = status.phase === 'available' || status.phase === 'permission' ? status.release : null;
  const retry = status.phase === 'failed' ? status.release : null;
  const close = () => BackHandler.exitApp();

  let message: string;
  switch (status.phase) {
    case 'available':
      message = t('Version {version} is available.', { version: shortVersion(status.release) });
      break;
    case 'downloading':
      message = `${t('Downloading version {version}…', { version: shortVersion(status.release) })}${
        status.progress !== null ? ` ${Math.floor(status.progress * 100)}%` : ''
      }`;
      break;
    case 'installing':
      message = t(
        'Android asks you to confirm the installation. The app restarts with the new version. No installer on the screen? Open it again.',
      );
      break;
    case 'permission':
      message = t(
        'Android needs your permission for this app to install updates. In the screen that opens, turn on “Allow from this source”, come back, then choose Update now.',
      );
      break;
    case 'failed':
      message = status.message;
      break;
    default:
      message = !updateRepo
        ? t('This build does not check for updates.')
        : checked
          ? t('No newer version is available yet. Try again later.')
          : t('Checking for updates…');
  }

  return (
    <View style={styles.screen} testID="start-failed">
      <Text style={styles.title}>{t('The app could not start')}</Text>
      <Text style={styles.text}>{t('Something went wrong while starting. Your data is safe. A newer version may fix it.')}</Text>
      <ScrollView style={styles.detail}>
        <Text style={styles.detailText}>{detail}</Text>
      </ScrollView>
      <Text style={styles.status} testID="start-failed-status">
        {message}
      </Text>
      {status.phase === 'downloading' || (status.phase === 'idle' && !checked && updateRepo) ? <ActivityIndicator color="#6aa9ff" /> : null}
      <View style={styles.row}>
        {install ? (
          <StartButton label={t('Update now')} primary preferred onPress={() => void updater.install(install)} testID="start-update" />
        ) : null}
        {status.phase === 'permission' ? (
          <StartButton
            label={t('Open settings')}
            onPress={() => {
              try {
                TvMedia.openInstallSettings();
              } catch {
                // No settings screen to open; the text above explains what to allow.
              }
            }}
            testID="start-settings"
          />
        ) : null}
        {status.phase === 'installing' ? (
          <StartButton
            label={t('Open the installer again')}
            primary
            preferred
            onPress={() => void updater.reopenInstaller()}
            testID="start-reopen"
          />
        ) : null}
        {status.phase === 'failed' ? (
          <StartButton
            label={t('Try again')}
            primary
            preferred
            onPress={() => void (retry ? updater.install(retry) : updater.check(true))}
            testID="start-retry"
          />
        ) : null}
        <StartButton
          label={t('Close')}
          preferred={!install && status.phase !== 'installing' && status.phase !== 'failed'}
          onPress={close}
          testID="start-close"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#14161a', padding: 32, gap: 12, justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '700' },
  text: { color: '#dddddd', fontSize: 16 },
  detail: { maxHeight: 120, backgroundColor: '#0b0c0e', borderRadius: 6, padding: 8 },
  detailText: { color: '#f0b4b4', fontSize: 12 },
  status: { color: '#9fd0ff', fontSize: 16 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6, borderWidth: 2, borderColor: '#555', backgroundColor: '#252a31' },
  primary: { backgroundColor: '#2d6cdf', borderColor: '#2d6cdf' },
  focused: { borderColor: '#ffffff' },
  buttonText: { color: '#ffffff', fontSize: 16 },
});
