import { Platform, StyleSheet, Text, View } from 'react-native';
import { episodeLabel, type Episode, t } from '@iptv/shared';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts, useSizes } from './ui/theme';

interface NextUpProps {
  episode: Episode;
  /** Already capped at `NEXT_UP_COUNTDOWN_SECONDS`. */
  secondsLeft: number;
  onPlayNow(): void;
  onDismiss(): void;
}

/**
 * The countdown card in the last seconds of an episode, the same on every app (issue #237, DECISIONS.md#d-211).
 * TV: Play Now takes the focus. The desktop announces it as a polite status.
 */
export function NextUp({ episode, secondsLeft, onPlayNow, onDismiss }: NextUpProps) {
  const { gutter } = useSizes();
  const web = Platform.OS === 'web' ? { role: 'status' as const, 'aria-live': 'polite' as const } : {};
  return (
    <View style={[styles.card, { right: gutter }]} testID="next-up" {...web}>
      <Text style={styles.label}>{t('Next episode in {seconds}', { seconds: secondsLeft })}</Text>
      <Text style={styles.title}>
        {episodeLabel(episode)} · {episode.title}
      </Text>
      <FocusRow style={styles.row}>
        <FocusButton label={t('Play Now')} variant="primary" hasTVPreferredFocus onPress={onPlayNow} testID="play-next" />
        <FocusButton label={t('Cancel')} onPress={onDismiss} />
      </FocusRow>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 120,
    width: 360,
    maxWidth: '90%',
    padding: 16,
    gap: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(20,20,20,0.95)',
    zIndex: 4,
  },
  label: { color: colors.muted, fontSize: fonts.small },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
});
