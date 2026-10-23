import { t } from '@iptv/shared';
import { colors } from './theme';

/** `ProgressRing.tsx` for React Native Web (desktop): a plain SVG element, so the desktop needs no react-native-svg. */
export function ProgressRing({ value, size = 32, stroke = 3 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)', display: 'block' }}
      role="progressbar"
      aria-label={t('{percent} percent', { percent })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.accent}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        strokeLinecap="round"
      />
    </svg>
  );
}
