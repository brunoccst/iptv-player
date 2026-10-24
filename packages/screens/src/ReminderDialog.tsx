import { StyleSheet, Text } from 'react-native';
import { t, type PlayTarget } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts } from './ui/theme';

/**
 * A guide reminder whose programme has started (issue #239, DECISIONS.md#d-184), over any page and the player, the same
 * on every app (issue #237, DECISIONS.md#d-214). Watch tunes to the channel; Dismiss, Back or Escape closes it. Focus
 * stays inside while it is open.
 */
export function ReminderDialog({ onWatch }: { onWatch(target: PlayTarget): void }) {
  const { reminder, dismiss, target } = useScreenHost().hooks.useDueReminder();
  if (!reminder || !target) return null;
  return (
    <Dialog
      title={t('Starting now: {title}', { title: reminder.title })}
      label={t('Reminder')}
      onClose={dismiss}
      testID="reminder"
      width={480}
    >
      <Text style={styles.line}>{reminder.channel.name}</Text>
      <FocusRow style={styles.actions}>
        <FocusButton
          label={t('Watch')}
          icon="play"
          variant="primary"
          hasTVPreferredFocus
          testID="reminder-watch"
          onPress={() => {
            dismiss();
            onWatch(target);
          }}
        />
        <FocusButton label={t('Dismiss')} variant="ghost" testID="reminder-dismiss" onPress={dismiss} />
      </FocusRow>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  line: { color: colors.muted, fontSize: fonts.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
