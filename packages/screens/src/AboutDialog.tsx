import { StyleSheet, Text, View } from 'react-native';
import { t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → App → About (D-070, D-079): what the app knows about itself, as the host gives it (version, the commit
 * and date it was built from; TV: the FFmpeg audio decoders and Android version), and checking for updates where it can.
 */
export function AboutDialog({ onClose }: { onClose(): void }) {
  const { signIn, about } = useScreenHost();
  const rows = about.rows();
  const { checkForUpdates } = about;
  return (
    <Dialog title={signIn.appName} label={t('About')} onClose={onClose} testID="about-dialog" width={440}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value} testID={`about-${label.toLowerCase().split(' ')[0]}`}>
            {value}
          </Text>
        </View>
      ))}
      {checkForUpdates ? (
        <FocusButton
          label={t('Check for updates')}
          variant="primary"
          hasTVPreferredFocus
          testID="about-update"
          onPress={() => {
            onClose();
            checkForUpdates();
          }}
        />
      ) : null}
      <FocusButton label={t('Close')} variant="ghost" hasTVPreferredFocus={!checkForUpdates} onPress={onClose} testID="about-close" />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { color: colors.muted, fontSize: fonts.small },
  value: { color: colors.text, fontSize: fonts.small, flexShrink: 1, textAlign: 'right' },
});
