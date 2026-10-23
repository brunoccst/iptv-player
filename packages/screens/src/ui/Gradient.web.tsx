import type { StyleProp, ViewStyle } from 'react-native';
import type { GradientStop } from './Gradient';

export type { GradientStop };

/** `#rgb` or `#rrggbb` with an opacity, as CSS `rgba()`; other colours are used as they are. */
function withOpacity(color: string, opacity = 1): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex || opacity === 1) return color;
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Desktop: the same shade as a CSS `linear-gradient` (TV and phone draw it with react-native-svg). */
export function Gradient({ stops, angle = 180 }: { stops: GradientStop[]; angle?: number; style?: StyleProp<ViewStyle> }) {
  const parts = stops.map((stop) => `${withOpacity(stop.color, stop.opacity)} ${stop.offset * 100}%`);
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(${angle}deg, ${parts.join(', ')})` }}
    />
  );
}
