import { useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text } from 'react-native';
import { t, useAppStore } from '@iptv/shared';
import { LogView } from '@iptv/screens';
import '../screenHost';
import { appConfig } from '../config';
import { logReport } from '../diagnostics/logReport';
import { getTvLog, pairedTv } from '../pairing/remote';
import { colors, useSizes, useNavHeight } from '../theme';

/**
 * Diagnostics log page around the shared log view (DECISIONS.md#d-220): "Share log" (Android share sheet) so it can be
 * sent for analysis. On a phone paired with a TV, "Get TV log" fetches the TV's log and shares it from the phone (D-039).
 */
export function LogScreen() {
  const [fetching, setFetching] = useState(false);
  const sizes = useSizes();
  const navH = useNavHeight();
  const tv = useAppStore(pairedTv, (s) => s.tv);

  const share = () => {
    void Share.share({ title: `${appConfig.appName} log`, message: logReport() });
  };

  const shareTvLog = () => {
    if (fetching) return;
    setFetching(true);
    getTvLog()
      .then(({ tvName, log }) => Share.share({ title: `${appConfig.appName} log (${tvName})`, message: log }))
      .catch((error: unknown) => Alert.alert(t('Get TV log'), error instanceof Error ? error.message : String(error)))
      .finally(() => setFetching(false));
  };

  return (
    <ScrollView
      style={styles.screen}
      testID="log-screen"
      contentContainerStyle={{ paddingTop: navH + 24, paddingHorizontal: sizes.gutter, paddingBottom: 60 }}
    >
      <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>{t('Log')}</Text>
      <LogView
        hints={[
          t('Share this with support when something goes wrong. The server address, usernames, passwords and keys are hidden.'),
          ...(Platform.isTV ? [t('To share this log from your phone: open the app on the phone, then Log → Get TV log.')] : []),
        ]}
        actions={[
          { label: t('Share log'), onPress: share, testID: 'log-share' },
          ...(!Platform.isTV && tv
            ? [{ label: fetching ? t('Getting the TV log…') : t('Get TV log'), onPress: shareTvLog, testID: 'log-get-tv' }]
            : []),
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
});
