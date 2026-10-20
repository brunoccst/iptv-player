import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colorTokens, sizeTokens, t } from '@iptv/shared';

/**
 * A title's cover, name and line under it, written once in React Native (issue #237, DECISIONS.md#d-193). On desktop
 * React Native Web turns it into DOM; the hover and keyboard focus look come from Pressable's state.
 */
export function PosterTile({
  title,
  posterUrl,
  subtitle,
  badge,
  watched,
  onList,
  width,
  onPress,
}: {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  watched?: boolean;
  onList?: boolean;
  width: number;
  onPress(): void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ width }}>
      {(state) => {
        // `hovered` is React Native Web's; on TV and phone only `focused` and `pressed` change.
        const lit = state.pressed || (state as { hovered?: boolean }).hovered || (state as { focused?: boolean }).focused;
        return (
          <>
            <View style={[styles.art, { height: Math.round((width * 3) / 2) }, lit && styles.lit]}>
              {posterUrl && !failed ? (
                <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
              ) : (
                <Text style={styles.fallback} numberOfLines={4}>
                  {title}
                </Text>
              )}
              {badge ? <Text style={[styles.tag, styles.badge]}>{badge}</Text> : null}
              {onList ? (
                <View style={styles.onList} accessibilityLabel={t('On My List')} accessibilityRole="image">
                  <View style={styles.bookmark} />
                </View>
              ) : null}
              {watched ? <Text style={[styles.tag, styles.watched]}>{t('Watched')}</Text> : null}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  art: {
    borderRadius: sizeTokens.radius,
    overflow: 'hidden',
    backgroundColor: colorTokens.surfaceRaised,
    justifyContent: 'center',
  },
  lit: { transform: [{ scale: 1.05 }] },
  fallback: { color: colorTokens.text, textAlign: 'center', padding: 8, fontSize: 14 },
  tag: {
    position: 'absolute',
    color: colorTokens.textStrong,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  badge: { top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.75)' },
  watched: { bottom: 6, right: 6, backgroundColor: colorTokens.success },
  onList: { position: 'absolute', top: 6, right: 6, padding: 4, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.75)' },
  bookmark: { width: 10, height: 13, backgroundColor: colorTokens.textStrong },
  title: { color: colorTokens.textStrong, fontSize: 14, fontWeight: '700', marginTop: 8, marginHorizontal: 4 },
  subtitle: { color: colorTokens.muted, fontSize: 12, marginTop: 2, marginHorizontal: 4 },
});
