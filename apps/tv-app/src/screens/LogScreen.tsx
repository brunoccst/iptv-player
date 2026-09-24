import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { appLog } from '@iptv/shared';
import { stores } from '../appContext';
import { appConfig } from '../config';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts, safe, spacing } from '../theme';

const PREVIEW_LINES = 150;

/** Diagnostics log: preview plus "Share log" (Android share sheet) so it can be sent for analysis. Credentials are masked. */
export function LogScreen() {
  const [, refresh] = useState(0);
  const entries = appLog.entries();

  const share = () => {
    const connection = stores.connection?.getState();
    const header = [
      `${appConfig.appName} diagnostics log`,
      `Shared ${new Date().toISOString()} · Android ${Platform.Version} · mode ${connection?.mode ?? 'server'}`,
      `${entries.length} lines (credentials masked)`,
      '',
    ].join('\n');
    void Share.share({ title: `${appConfig.appName} log`, message: header + appLog.text() });
  };

  return (
    <ScrollView style={styles.screen} testID="log-screen">
      <Text style={styles.title}>Log</Text>
      <Text style={styles.hint}>Share this with support when something goes wrong. Usernames and passwords are hidden.</Text>
      <View style={styles.actions}>
        <FocusButton label="Share log" variant="primary" hasTVPreferredFocus onPress={share} testID="log-share" />
        <FocusButton
          label="Clear log"
          onPress={() => {
            appLog.clear();
            refresh((n) => n + 1);
          }}
          testID="log-clear"
        />
      </View>
      {entries.slice(-PREVIEW_LINES).map((entry, index) => (
        <Text
          key={`${entry.at}-${index}`}
          style={[styles.line, entry.level === 'error' && styles.error, entry.level === 'warn' && styles.warn]}
        >
          {`${entry.at.slice(11, 19)} [${entry.area}] ${entry.message}`}
        </Text>
      ))}
      {entries.length === 0 ? <Text style={styles.hint}>Nothing logged yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical, paddingHorizontal: safe.horizontal },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700', marginBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: fonts.small, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  line: { color: colors.text, fontSize: fonts.small, fontFamily: 'monospace', marginBottom: 2 },
  warn: { color: '#e5b400' },
  error: { color: '#ff6b6b' },
});
