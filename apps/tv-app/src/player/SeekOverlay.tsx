import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SCRUB_BASE_SPEED, SKIP_SECONDS, formatClock, type SeekDirection } from '@iptv/shared';
import { colors, fonts, safe } from '../theme';

/** Animated circle shown on a D-pad tap: "−10" left, "+10" right. `flashKey` restarts the animation. */
export function TapFlash({ direction, flashKey }: { direction: SeekDirection; flashKey: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 650, useNativeDriver: true }).start();
  }, [flashKey, progress]);

  return (
    <Animated.View
      testID={`tap-flash-${direction}`}
      style={[
        styles.flash,
        direction === 'back' ? styles.flashLeft : styles.flashRight,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }],
        },
      ]}
    >
      <Text style={styles.flashArrow}>{direction === 'back' ? '◀◀' : '▶▶'}</Text>
      <Text style={styles.flashText}>
        {direction === 'back' ? '−' : '+'}
        {SKIP_SECONDS}
      </Text>
    </Animated.View>
  );
}

/** Scrub preview: marker at the preview time, current speed multiplier. */
export function ScrubBar({ preview, speed, duration }: { preview: number; speed: number; duration: number }) {
  const percent = duration > 0 ? Math.min(100, (preview / duration) * 100) : 0;
  return (
    <View style={styles.scrub} testID="scrub-bar">
      <View style={styles.scrubHeader}>
        <Text style={styles.scrubTime}>{formatClock(preview)}</Text>
        <Text style={styles.scrubSpeed}>×{Math.round(speed / SCRUB_BASE_SPEED)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
        <View style={[styles.marker, { left: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    position: 'absolute',
    top: '40%',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashLeft: { left: '15%' },
  flashRight: { right: '15%' },
  flashArrow: { color: colors.strong, fontSize: fonts.heading },
  flashText: { color: colors.strong, fontSize: fonts.title, fontWeight: '700' },
  scrub: { position: 'absolute', left: safe.horizontal, right: safe.horizontal, bottom: safe.vertical + 40 },
  scrubHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scrubTime: { color: colors.strong, fontSize: fonts.title, fontWeight: '700' },
  scrubSpeed: { color: colors.accent, fontSize: fonts.title, fontWeight: '900' },
  track: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: 6, backgroundColor: colors.accent },
  marker: { position: 'absolute', top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: colors.strong },
});
