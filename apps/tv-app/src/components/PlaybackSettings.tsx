import { Modal, StyleSheet, Text, View } from 'react-native';
import type { AudioDecoderChoice } from '../../modules/tv-media';
import { playbackSettings } from '../appContext';
import { usePlaybackSettings } from '../hooks';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';

const CHOICES: { value: AudioDecoderChoice; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automatic', hint: 'Phones: FFmpeg first. TVs: the device first, so Dolby can reach a soundbar.' },
  { value: 'device', label: 'Device decoders first', hint: 'FFmpeg only for formats the device cannot play.' },
  { value: 'ffmpeg', label: 'FFmpeg first', hint: 'Software decoding; try this when a title has no sound or stops with an audio error.' },
];

/** Account menu → Playback: which audio decoders the player tries first (D-059). Applies to the next title. */
export function PlaybackSettings({ onClose }: { onClose(): void }) {
  const current = usePlaybackSettings((s) => s.audioDecoder);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="playback-settings">
          <Text style={styles.title}>Audio decoder</Text>
          <Text style={styles.text}>Applies to the next title you start.</Text>
          {CHOICES.map((choice) => (
            <View key={choice.value} style={styles.choice}>
              <FocusButton
                label={`${current === choice.value ? '✓ ' : ''}${choice.label}`}
                variant={current === choice.value ? 'primary' : 'ghost'}
                hasTVPreferredFocus={current === choice.value}
                testID={`audio-decoder-${choice.value}`}
                onPress={() => void playbackSettings.getState().setAudioDecoder(choice.value)}
              />
              <Text style={styles.hint}>{choice.hint}</Text>
            </View>
          ))}
          <FocusButton label="Close" variant="ghost" onPress={onClose} testID="playback-settings-close" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 420,
    maxWidth: '100%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  text: { color: colors.text, fontSize: fonts.small },
  choice: { gap: 4 },
  hint: { color: colors.muted, fontSize: fonts.tiny },
});
