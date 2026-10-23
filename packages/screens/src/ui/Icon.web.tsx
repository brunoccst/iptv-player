import { iconPaths, type IconName } from '@iptv/shared';
import { colors } from './theme';

export type { IconName };

/** `Icon.tsx` for React Native Web (desktop): a plain SVG element, so the desktop needs no react-native-svg. */
export function Icon({ name, size = 24, color = colors.strong }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}
