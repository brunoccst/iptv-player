import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

/** Circular download progress (0..1). */
export function ProgressRing({ value, size = 32, stroke = 3 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }} accessibilityLabel={`${Math.round(clamped * 100)} percent`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.accent} strokeWidth={stroke} fill="none"
        strokeDasharray={`${circumference}`} strokeDashoffset={circumference * (1 - clamped)} strokeLinecap="round" />
    </Svg>
  );
}
