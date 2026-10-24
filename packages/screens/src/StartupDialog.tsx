import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { t } from '@iptv/shared';
import { useScreenHost } from './host';
import { CheckRow } from './ui/CheckRow';
import { Dialog } from './ui/Dialog';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → App → Start with the computer (issue #309, DECISIONS.md#d-226), in the apps that can (the desktop):
 * the app starts in the tray at sign-in and closing the window keeps it there, so guide reminders still show.
 */
export function StartupDialog({ onClose }: { onClose(): void }) {
  const { account } = useScreenHost();
  const startup = account.startup;
  const [on, setOn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void startup?.get().then(
      (value) => alive && setOn(value),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [startup]);

  const toggle = () => {
    if (!startup || on === null) return;
    setFailed(false);
    startup.set(!on).then(setOn, () => setFailed(true));
  };

  return (
    <Dialog title={t('Start with the computer')} onClose={onClose} testID="startup-dialog" width={480}>
      <Text style={styles.text}>
        {t(
          'The app opens in the tray when you sign in to the computer, and closing the window keeps it there. Guide reminders and downloads go on. Quit from the tray icon.',
        )}
      </Text>
      <CheckRow label={t('Start with the computer')} checked={on === true} onPress={toggle} testID="startup-toggle" />
      {failed ? <Text style={styles.error}>{t('The setting could not be changed.')}</Text> : null}
      <FocusButton label={t('Close')} variant="ghost" onPress={onClose} testID="startup-close" />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: fonts.small },
  error: { color: colors.warning, fontSize: fonts.small },
});
