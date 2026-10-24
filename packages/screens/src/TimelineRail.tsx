import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './ui/theme';

interface TimelineRailProps {
  /** How much has played, 0..1. */
  played: number;
  /** Desktop: how much the browser has loaded, 0..1. */
  buffered?: number;
  /** Desktop: where the mouse is, 0..1 (a lighter fill up to it). */
  hover?: number | null;
  /** `focused`: TV focus is on the bar; `dragging`: a finger or mouse holds the thumb; `hover`: the mouse is over it. */
  state?: 'idle' | 'hover' | 'focused' | 'dragging';
  /** The time shown above the rail at `at`, or null for none. */
  label?: string | null;
  /** Where the label and the frame sit, 0..1 (defaults to `played`). */
  at?: number;
  /** The preview picture (D-180) shown over the rail at `at`, kept inside the bar, or null. */
  frame?: ReactNode;
  frameWidth?: number;
}

/**
 * The player's progress bar as drawn on every app (issue #237, DECISIONS.md#d-218): rail, played and loaded parts, thumb,
 * time and preview frame. It takes no input; each app wraps it in what moves the video (TV keys, touch, mouse).
 */
export function TimelineRail({
  played,
  buffered,
  hover = null,
  state = 'idle',
  label = null,
  at = played,
  frame = null,
  frameWidth = 192,
}: TimelineRailProps) {
  const [width, setWidth] = useState(0);
  const percent = (value: number) => `${Math.min(1, Math.max(0, value)) * 100}%` as const;
  const frameLeft = Math.max(0, Math.min(width - frameWidth, at * width - frameWidth / 2));
  return (
    <View style={styles.box} pointerEvents="none" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {frame ? (
        <View style={[styles.frame, { left: frameLeft, width: frameWidth, height: (frameWidth * 9) / 16 }]} testID="player-preview-frame">
          {frame}
        </View>
      ) : null}
      <View style={[styles.rail, state === 'hover' && styles.railHover, state === 'focused' && styles.railFocused]} testID="timeline-rail">
        {buffered !== undefined ? <View style={[styles.fill, styles.buffered, { width: percent(buffered) }]} /> : null}
        {hover !== null ? <View style={[styles.fill, styles.hover, { width: percent(hover) }]} /> : null}
        <View style={[styles.fill, styles.played, { width: percent(played) }]} />
        <View
          style={[
            styles.thumb,
            state === 'dragging' && styles.thumbDragging,
            state === 'focused' && styles.thumbFocused,
            { left: percent(played) },
          ]}
        />
      </View>
      {label !== null ? (
        <Text style={[styles.label, { left: percent(at) }]} testID="player-timeline-time">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', justifyContent: 'center' },
  rail: { height: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  railHover: { height: 7, marginVertical: -1.5 },
  railFocused: { height: 6, marginVertical: -1, backgroundColor: 'rgba(255,255,255,0.45)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  buffered: { backgroundColor: 'rgba(255,255,255,0.4)' },
  hover: { backgroundColor: 'rgba(255,255,255,0.25)' },
  played: { backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    marginTop: -7,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: colors.accent,
  },
  thumbDragging: { width: 20, height: 20, marginTop: -10, marginLeft: -10, borderRadius: 10 },
  thumbFocused: { width: 24, height: 24, marginTop: -12, marginLeft: -12, borderRadius: 12, backgroundColor: colors.strong },
  frame: {
    position: 'absolute',
    bottom: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.strong,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  label: {
    position: 'absolute',
    bottom: 8,
    width: 80,
    marginLeft: -40,
    textAlign: 'center',
    color: colors.strong,
    fontSize: fonts.small,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
  },
});
