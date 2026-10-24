import { StyleSheet, View } from 'react-native';
import { SKIP_AHEAD_OPTIONS, skipAheadDescription, skipAheadLabel, t } from '@iptv/shared';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { useSizes } from './ui/theme';

interface SkipAheadProps {
  /** The 30 s … 3 min options are showing. */
  open: boolean;
  onToggle(): void;
  /** One of `SKIP_AHEAD_OPTIONS` was picked; the app closes the options and seeks. */
  onSkip(seconds: number): void;
}

/**
 * The player's "Skip ahead" button and its options, instead of Skip Intro (D-042), the same on every app (issue #237,
 * DECISIONS.md#d-212). Each app decides when it shows (`isInSkipAheadWindow`) and closes it on Back or Escape.
 */
export function SkipAhead({ open, onToggle, onSkip }: SkipAheadProps) {
  const { gutter } = useSizes();
  return (
    <View style={[styles.corner, { right: gutter }]} testID="skip-ahead-panel">
      {open ? (
        <FocusRow style={styles.options} accessibilityLabel={t('Skip ahead by')}>
          {SKIP_AHEAD_OPTIONS.map((seconds, index) => (
            <FocusButton
              key={seconds}
              label={skipAheadLabel(seconds)}
              accessibilityLabel={skipAheadDescription(seconds)}
              hasTVPreferredFocus={index === 0}
              testID={`skip-ahead-${seconds}`}
              onPress={() => onSkip(seconds)}
            />
          ))}
        </FocusRow>
      ) : null}
      <FocusButton
        label={t('Skip ahead')}
        icon={open ? 'close' : 'forward10'}
        accessibilityLabel={open ? t('Close skip options') : t('Skip ahead: choose how far')}
        expanded={open}
        hasTVPreferredFocus={!open}
        onPress={onToggle}
        testID="skip-ahead"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', bottom: 120, alignItems: 'flex-end', gap: 8, zIndex: 4 },
  options: { flexDirection: 'row', gap: 8 },
});
