import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { TvMedia } from '../../modules/tv-media';
import { Icon } from '../components/Icon';
import { colors, fonts } from '../theme';

export type LevelKind = 'brightness' | 'volume';

/** Top and bottom bands of the screen where a slide is left to the system (notifications, navigation bar). */
const EDGE = 0.08;
/** A slide over this part of the screen's height goes from 0 to 100 %. */
const RANGE = 0.6;
/** The bar stays a second after the finger lifts (issue #184). */
const BAR_AFTER_MS = 1000;

/** Brightness chosen in a player during this run of the app; the next player starts with it (D-155). */
let sessionBrightness: number | null = null;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Phones (issue #184, D-155): a vertical slide on the left third of the video sets the screen brightness, on the right
 * third the media volume; a bar shows the level while sliding and a second after. Live channels: a swipe up in the
 * middle third opens the guide (D-058). The brightness is the player's own and the system's comes back when it closes.
 */
export function usePlayerSwipes(enabled: boolean, onSwipeUp: (() => void) | null) {
  const { width, height } = useWindowDimensions();
  const latest = useRef({ enabled, onSwipeUp, width, height });
  latest.current = { enabled, onSwipeUp, width, height };
  const [level, setLevel] = useState<{ kind: LevelKind; value: number } | null>(null);
  const mode = useRef<LevelKind | 'guide'>('volume');
  const slide = useRef<{ kind: LevelKind; start: number; value: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.isTV) return;
    if (sessionBrightness !== null) void TvMedia.setBrightness(sessionBrightness);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (sessionBrightness !== null) void TvMedia.setBrightness(-1);
    };
  }, []);

  const end = () => {
    slide.current = null;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setLevel(null), BAR_AFTER_MS);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        const { enabled, onSwipeUp, width, height } = latest.current;
        if (!enabled || Platform.isTV || Math.abs(gesture.dy) < 12 || Math.abs(gesture.dy) < Math.abs(gesture.dx) * 2) {
          return false;
        }
        const x = gesture.moveX - gesture.dx;
        const y = gesture.moveY - gesture.dy;
        const kind: LevelKind | null = x < width / 3 ? 'brightness' : x > (width * 2) / 3 ? 'volume' : null;
        if (kind) {
          if (y < height * EDGE || y > height * (1 - EDGE)) return false;
          mode.current = kind;
          return true;
        }
        if (onSwipeUp && gesture.dy < -40) {
          mode.current = 'guide';
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {
        const kind = mode.current;
        if (kind === 'guide') {
          latest.current.onSwipeUp?.();
          return;
        }
        if (hideTimer.current) clearTimeout(hideTimer.current);
        const start = kind === 'brightness' ? TvMedia.brightness() : TvMedia.volume();
        slide.current = { kind, start, value: start };
        setLevel({ kind, value: start });
      },
      onPanResponderMove: (_, gesture) => {
        const current = slide.current;
        if (!current) return;
        const value = Math.round(clamp(current.start - gesture.dy / (latest.current.height * RANGE)) * 100) / 100;
        if (value === current.value) return;
        current.value = value;
        if (current.kind === 'brightness') {
          sessionBrightness = value;
          void TvMedia.setBrightness(value);
          setLevel({ kind: 'brightness', value });
        } else setLevel({ kind: 'volume', value: TvMedia.setVolume(value) });
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    }),
  ).current;

  return { panHandlers: pan.panHandlers, level };
}

/** The brightness or volume bar on the side being slid. */
export function LevelBar({ kind, value }: { kind: LevelKind; value: number }) {
  const percent = Math.round(value * 100);
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, kind === 'brightness' ? styles.left : styles.right]} pointerEvents="none">
      <View style={styles.bar} testID={`level-${kind}`}>
        <Icon name={kind === 'brightness' ? 'brightness' : percent === 0 ? 'mute' : 'volume'} size={22} />
        <View style={styles.track}>
          <View style={[styles.fill, { height: `${percent}%` }]} />
        </View>
        <Text style={styles.text} testID="level-percent">
          {percent}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center', paddingHorizontal: 40 },
  left: { alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  bar: {
    alignItems: 'center',
    gap: 10,
    width: 56,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: colors.scrim,
  },
  track: {
    width: 4,
    height: 120,
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  fill: { width: '100%', backgroundColor: colors.strong },
  text: { color: colors.strong, fontSize: fonts.small, fontWeight: '600' },
});
