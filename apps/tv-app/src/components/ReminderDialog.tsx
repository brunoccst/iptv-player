import { Modal, StyleSheet, Text, View } from 'react-native';
import { t } from '@iptv/shared';
import { navStore } from '../appContext';
import { useDueReminder } from '../hooks';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';
import { FocusRow } from './FocusRow';

/**
 * A guide reminder whose programme has started (issue #239, DECISIONS.md#d-184), over any page and the player. Watch
 * tunes to the channel; Dismiss or Back closes it. Focus stays inside while it is open.
 */
export function ReminderDialog() {
  const { reminder, dismiss, target } = useDueReminder();
  if (!reminder || !target) return null;

  const watch = () => {
    dismiss();
    const nav = navStore.getState();
    if (nav.stack.at(-1)?.name === 'player') nav.replaceTop({ name: 'player', target });
    else nav.push({ name: 'player', target });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="reminder">
          <Text style={styles.title}>{t('Starting now: {title}', { title: reminder.title })}</Text>
          <Text style={styles.line}>{reminder.channel.name}</Text>
          <FocusRow style={styles.actions}>
            <FocusButton label={t('Watch')} icon="play" variant="primary" hasTVPreferredFocus testID="reminder-watch" onPress={watch} />
            <FocusButton label={t('Dismiss')} variant="ghost" testID="reminder-dismiss" onPress={dismiss} />
          </FocusRow>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 480,
    maxWidth: '100%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.heading, fontWeight: '700' },
  line: { color: colors.muted, fontSize: fonts.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
