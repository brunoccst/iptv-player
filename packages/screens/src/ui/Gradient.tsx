import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

/**
 * CSS `linear-gradient` for React Native (drawn with react-native-svg), used for the web's hero and nav shades.
 * `angle` follows CSS: 180 = top → bottom, 90 = left → right.
 */
export function Gradient({ stops, angle = 180, style }: { stops: GradientStop[]; angle?: number; style?: StyleProp<ViewStyle> }) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(radians) / 2;
  const y = Math.sin(radians) / 2;
  const id = `g${angle}-${stops.map((s) => `${s.color}${s.offset}${s.opacity ?? 1}`).join('')}`.replace(/[^A-Za-z0-9-]/g, '');
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
          {stops.map((stop) => (
            <Stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
