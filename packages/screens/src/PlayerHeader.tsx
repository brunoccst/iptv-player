import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { fluid, t } from '@iptv/shared';
import { IconButton } from './ui/IconButton';
import { colors, fonts, useSizes } from './ui/theme';

interface PlayerHeaderProps {
  title: string;
  /** The episode, version or programme playing. */
  subtitle?: string | null;
  /** Playing a download: adds "Downloaded" to the subtitle. */
  downloaded?: boolean;
  live?: boolean;
  onBack(): void;
  /** TV: the back arrow is only focusable while the player's buttons are open (the remote keys drive the video). */
  backFocusable?: boolean;
  backPreferredFocus?: boolean;
}

/**
 * The bar at the top of the player (back arrow, title, subtitle, LIVE), the same on every app (issue #237,
 * DECISIONS.md#d-213). The app shows and hides it with the rest of its controls.
 */
export function PlayerHeader({ title, subtitle, downloaded, live, onBack, backFocusable, backPreferredFocus }: PlayerHeaderProps) {
  const { width } = useWindowDimensions();
  const { gutter } = useSizes();
  const line = [subtitle, downloaded ? t('Downloaded') : null].filter(Boolean).join(' · ');
  const heading = Platform.OS === 'web' ? { role: 'heading' as const, 'aria-level': 2 } : { accessibilityRole: 'header' as const };
  return (
    <View style={[styles.top, { paddingHorizontal: gutter }]}>
      <IconButton
        icon="back"
        label={t('Back')}
        testID="player-back"
        plain
        focusable={backFocusable}
        hasTVPreferredFocus={backPreferredFocus}
        size={44}
        iconSize={28}
        onPress={onBack}
      />
      <View style={styles.heading}>
        <Text style={[styles.title, { fontSize: fluid(width, 16, 2, 22) }]} numberOfLines={1} testID="player-title" {...heading}>
          {title}
        </Text>
        {line ? (
          <Text style={styles.subtitle} numberOfLines={1} testID="player-subtitle">
            {line}
          </Text>
        ) : null}
      </View>
      {live ? (
        <Text style={styles.live} testID="player-live">
          {t('LIVE')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 20 },
  heading: { flexShrink: 1 },
  title: { color: colors.strong, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14.4, marginTop: 2 },
  live: {
    color: colors.strong,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
    overflow: 'hidden',
    fontSize: fonts.tiny,
    fontWeight: '700',
  },
});
