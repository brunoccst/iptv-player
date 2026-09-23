import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { card, colors, fonts, spacing } from '../theme';

export interface PosterCardProps {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  /** 0..1 watch progress bar. */
  progress?: number;
  landscape?: boolean;
  hasTVPreferredFocus?: boolean;
  onPress(): void;
  onFocus?(): void;
}

export function PosterCard({ title, posterUrl, subtitle, badge, progress, landscape, hasTVPreferredFocus, onPress, onFocus }: PosterCardProps) {
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  const size = landscape ? { width: card.landscapeWidth, height: card.landscapeHeight } : { width: card.width, height: card.height };

  return (
    <Pressable
      testID={`card-${title}`}
      accessibilityRole="button"
      accessibilityLabel={title}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.card, { width: size.width }, focused && styles.focused]}
    >
      <View style={[styles.art, size, focused && styles.artFocused]}>
        {posterUrl && !failed ? (
          <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
        ) : (
          <Text style={styles.fallback} numberOfLines={3}>{title}</Text>
        )}
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        {progress !== undefined ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressValue, { width: `${Math.round(Math.min(1, progress) * 100)}%` }]} />
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginRight: spacing.md },
  focused: { transform: [{ scale: 1.1 }], zIndex: 2 },
  art: { borderRadius: 4, overflow: 'hidden', backgroundColor: colors.raised, borderWidth: 3, borderColor: 'transparent', justifyContent: 'center' },
  artFocused: { borderColor: colors.strong },
  fallback: { color: colors.strong, fontSize: fonts.body, fontWeight: '700', textAlign: 'center', padding: spacing.sm },
  badge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.75)', color: colors.strong, fontSize: 11, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 1 },
  progressTrack: { position: 'absolute', left: 8, right: 8, bottom: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressValue: { height: 3, backgroundColor: colors.accent },
  title: { color: colors.strong, fontSize: fonts.small, fontWeight: '700', marginTop: spacing.xs },
  subtitle: { color: colors.muted, fontSize: 11 },
});
