import { useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text } from 'react-native';
import { appLog, t, useAppStore } from '@iptv/shared';
import { appConfig } from '../config';
import { logReport } from '../diagnostics/logReport';
import { getTvLog, pairedTv } from '../pairing/remote';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts, useSizes, useNavHeight } from '../theme';
import { FocusRow } from '../components/FocusRow';

const PREVIEW_LINES = 150;

/**
 * Diagnostics log: preview plus "Share log" (Android share sheet) so it can be sent for analysis. On a phone paired with
 * a TV, "Get TV log" fetches the TV's log and shares it from the phone (D-173). Server, accounts and keys are masked.
 */
export function LogScreen() {
  const [, refresh] = useState(0);
  const [fetching, setFetching] = useState(false);
  const entries = appLog.entries();
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
      <Text style={styles.hint}>
        {t('Share this with support when something goes wrong. The server address, usernames, passwords and keys are hidden.')}
      </Text>
      {Platform.isTV ? (
        <Text style={styles.hint}>{t('To share this log from your phone: open the app on the phone, then Log → Get TV log.')}</Text>
      ) : null}
      <FocusRow style={styles.actions}>
        <FocusButton label={t('Share log')} variant="primary" hasTVPreferredFocus onPress={share} testID="log-share" />
        {!Platform.isTV && tv ? (
          <FocusButton
            label={fetching ? t('Getting the TV log…') : t('Get TV log')}
            variant="ghost"
            onPress={shareTvLog}
            testID="log-get-tv"
          />
        ) : null}
        <FocusButton
          label={t('Clear log')}
          variant="ghost"
          onPress={() => {
            appLog.clear();
            refresh((n) => n + 1);
          }}
          testID="log-clear"
        />
      </FocusRow>
      {entries.slice(-PREVIEW_LINES).map((entry, index) => (
        <Text
          key={`${entry.at}-${index}`}
          style={[styles.line, entry.level === 'error' && styles.error, entry.level === 'warn' && styles.warn]}
        >
          {`${entry.at.slice(11, 19)} [${entry.area}] ${entry.message}`}
        </Text>
      ))}
      {entries.length === 0 ? <Text style={styles.hint}>{t('Nothing logged yet.')}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
  hint: { color: colors.muted, fontSize: fonts.body, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  line: { color: colors.text, fontSize: fonts.small, fontFamily: 'monospace', marginBottom: 2 },
  warn: { color: '#e5b400' },
  error: { color: '#ff6b6b' },
});
