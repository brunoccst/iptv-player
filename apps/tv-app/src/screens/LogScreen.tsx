import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text } from 'react-native';
import { appLog, t } from '@iptv/shared';
import { appConfig } from '../config';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts, useSizes, useNavHeight } from '../theme';
import { FocusRow } from '../components/FocusRow';

const PREVIEW_LINES = 150;

/** Diagnostics log: preview plus "Share log" (Android share sheet) so it can be sent for analysis. Credentials are masked. */
export function LogScreen() {
  const [, refresh] = useState(0);
  const entries = appLog.entries();
  const sizes = useSizes();
  const navH = useNavHeight();

  const share = () => {
    // Newest lines only: share targets cut long texts off at the end, which lost the lines that mattered.
    const { text, lines, omitted } = appLog.shareText();
    const header = [
      `${appConfig.appName} diagnostics log`,
      `Shared ${new Date().toISOString()} · Android ${Platform.Version}`,
      `${lines} newest lines${omitted ? `, ${omitted} older left out` : ''}; repeats folded (credentials masked)`,
      '',
    ].join('\n');
    void Share.share({ title: `${appConfig.appName} log`, message: header + text });
  };

  return (
    <ScrollView
      style={styles.screen}
      testID="log-screen"
      contentContainerStyle={{ paddingTop: navH + 24, paddingHorizontal: sizes.gutter, paddingBottom: 60 }}
    >
      <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>{t('Log')}</Text>
      <Text style={styles.hint}>{t('Share this with support when something goes wrong. Usernames and passwords are hidden.')}</Text>
      <FocusRow style={styles.actions}>
        <FocusButton label={t('Share log')} variant="primary" hasTVPreferredFocus onPress={share} testID="log-share" />
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
