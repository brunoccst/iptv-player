import { StyleSheet, Text } from 'react-native';
import { t } from '@iptv/shared';
import { Dialog } from '@iptv/screens';
import { FocusButton } from './FocusButton';
import { FocusRow } from './FocusRow';
import { useOpenOnReminderPrompt } from '../tv/reminderAlarms';
import { colors, fonts } from '../theme';

/**
 * TV (issue #309, DECISIONS.md#d-238): asks once per run, while there are guide reminders, to allow "Display over other
 * apps", so a reminder opens the app when its programme starts, even from another app.
 */
export function OpenOnReminderPrompt({ enabled }: { enabled: boolean }) {
  const { visible, allow, later } = useOpenOnReminderPrompt(enabled);
  if (!visible) return null;
  return (
    <Dialog title={t('Open the app for your reminders?')} onClose={later} testID="reminder-open-prompt" width={560}>
      <Text style={styles.text}>
        {t(
          'When a programme you set a reminder for starts, the app can open on its own, even while you are in another app. Android asks you to allow "Display over other apps" for it: turn it on, then press Back.',
        )}
      </Text>
      <FocusRow style={styles.actions}>
        <FocusButton label={t('Open settings')} variant="primary" hasTVPreferredFocus onPress={allow} testID="reminder-open-allow" />
        <FocusButton label={t('Not now')} variant="ghost" onPress={later} testID="reminder-open-later" />
      </FocusRow>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.muted, fontSize: fonts.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
