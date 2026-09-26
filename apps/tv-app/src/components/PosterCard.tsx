import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, useSizes } from '../theme';
import { AnimatedPressable, focus, useFocusScale } from './focus';
import { useRowFocus } from './FocusRow';

export interface PosterCardProps {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  /** 0..1 watch progress bar. */
  progress?: number;
  landscape?: boolean;
  /** Overrides the web `--card-width` (grids stretch cards to fill a line). */
  width?: number;
  hasTVPreferredFocus?: boolean;
  /** Top-right corner actions (e.g. download button). */
  actions?: ReactNode;
  onPress(): void;
  onFocus?(): void;
}

/** Web `.card`: art (2:3 or 16:9) + title/subtitle on the surface colour; focus grows it smoothly with a soft light ring and glow. */
export function PosterCard({
  title,
  posterUrl,
  subtitle,
  badge,
  progress,
  landscape,
  width,
  hasTVPreferredFocus,
  actions,
  onPress,
  onFocus,
}: PosterCardProps) {
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  const { cardWidth } = useSizes();
  const cardSize = width ?? cardWidth;
  const scale = useFocusScale(focused, 1.08);
  const rowFocus = useRowFocus();

  return (
    <AnimatedPressable
      testID={`card-${title}`}
      accessibilityRole="button"
      accessibilityLabel={title}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        rowFocus?.();
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.card, { width: cardSize }, focused && styles.focused, { transform: [{ scale }] }]}
    >
      <View style={[styles.art, { aspectRatio: landscape ? 16 / 9 : 2 / 3 }]}>
        {/* Solid placeholder behind the poster: an SVG gradient per card made scrolling rows stutter on TV. */}
        {posterUrl && !failed ? (
          <Image
            source={{ uri: posterUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            // Provider posters are often full-size; decode at card size so scrolling stays smooth.
            resizeMethod="resize"
            onError={() => setFailed(true)}
          />
        ) : (
          <Text style={styles.fallback} numberOfLines={3}>
            {title}
          </Text>
        )}
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        {progress !== undefined ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressValue, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }]} />
          </View>
        ) : null}
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius + 2, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent' },
  focused: { zIndex: 2, borderColor: focus.ring, ...focus.glow },
  art: { width: '100%', borderRadius: radius, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#1f1f1f' },
  fallback: { color: colors.strong, fontSize: 16, fontWeight: '700', textAlign: 'center', padding: 10 },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: colors.strong,
    fontSize: 11.2,
    fontWeight: '700',
  },
  progressTrack: { position: 'absolute', left: 8, right: 8, bottom: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressValue: { height: 3, backgroundColor: colors.accent },
  actions: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 4 },
  meta: { paddingTop: 8, paddingHorizontal: 4, paddingBottom: 4 },
  title: { color: colors.strong, fontSize: 13.6, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
