import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appLog, t } from '@iptv/shared';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts } from './ui/theme';

const PREVIEW_LINES = 150;

export interface LogAction {
  label: string;
  onPress(): void;
  testID?: string;
}

/**
 * The diagnostics log as every app shows it (D-079, issue #237, DECISIONS.md#d-220): the app's notes, its ways to send
 * the log (TV and phone: the share sheet and "Get TV log"; desktop: save and copy), Clear log, and the last lines.
 * The TV shows it as a page, the desktop in a dialog. Server, accounts and keys are masked.
 */
export function LogView({ hints, actions }: { hints: string[]; actions: LogAction[] }) {
  const [, refresh] = useState(0);
  const entries = appLog.entries();
  return (
    <View testID="log-view">
      {hints.map((hint) => (
        <Text key={hint} style={styles.hint}>
          {hint}
        </Text>
      ))}
      <FocusRow style={styles.actions}>
        {actions.map((action, index) => (
          <FocusButton
            key={action.testID ?? action.label}
            label={action.label}
            variant={index === 0 ? 'primary' : 'ghost'}
            hasTVPreferredFocus={index === 0}
            onPress={action.onPress}
            testID={action.testID}
          />
        ))}
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
          selectable
        >
          {`${entry.at.slice(11, 19)} ${entry.level === 'info' ? '' : `${entry.level.toUpperCase()} `}[${entry.area}] ${entry.message}`}
        </Text>
      ))}
      {entries.length === 0 ? <Text style={styles.hint}>{t('Nothing logged yet.')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: fonts.body, marginBottom: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  line: { color: colors.text, fontSize: fonts.small, fontFamily: 'monospace', marginBottom: 2 },
  warn: { color: '#e5b400' },
  error: { color: '#ff6b6b' },
});
