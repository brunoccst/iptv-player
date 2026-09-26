import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { TvMedia } from '../../modules/tv-media';
import { stores, updater } from '../appContext';
import { appConfig, buildInfo, updateRepo } from '../config';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';

const installedVersion = () => {
  try {
    return TvMedia.installedVersion();
  } catch {
    return null;
  }
};

const ffmpegAudio = () => {
  try {
    return TvMedia.ffmpegAudioAvailable();
  } catch {
    return false;
  }
};

/**
 * Account menu → About: the installed version (the release's build number, as in "Check for updates"), the commit and
 * date it was built from, how the app connects, and whether the FFmpeg audio decoders are included.
 */
export function AboutDialog({ onClose }: { onClose(): void }) {
  const version = installedVersion();
  const connection = stores.connection?.getState();
  const rows: [string, string][] = [
    ['Version', version ? String(version.versionCode) : 'unknown'],
    ['Built from', buildInfo.commit ? buildInfo.commit.slice(0, 7) : 'a local build'],
    ...(buildInfo.date ? ([['Built on', new Date(buildInfo.date).toLocaleString()]] as [string, string][]) : []),
    ['Connection', connection?.mode === 'server' ? `My server (${connection.serverUrl})` : 'Directly to the IPTV provider'],
    ['Dolby / DTS audio (FFmpeg)', ffmpegAudio() ? 'included' : 'not included'],
    ['Android', String(Platform.Version)],
  ];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="about-dialog">
          <Text style={styles.title}>{appConfig.appName}</Text>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value} testID={`about-${label.toLowerCase().split(' ')[0]}`}>
                {value}
              </Text>
            </View>
          ))}
          {updateRepo ? (
            <FocusButton
              label="Check for updates"
              variant="primary"
              hasTVPreferredFocus
              testID="about-update"
              onPress={() => {
                onClose();
                updater.open();
                void updater.check();
              }}
            />
          ) : null}
          <FocusButton label="Close" variant="ghost" hasTVPreferredFocus={!updateRepo} onPress={onClose} testID="about-close" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 440,
    maxWidth: '100%',
    padding: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { color: colors.muted, fontSize: fonts.small },
  value: { color: colors.text, fontSize: fonts.small, flexShrink: 1, textAlign: 'right' },
});
