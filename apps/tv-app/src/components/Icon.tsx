import Svg, { Path } from 'react-native-svg';
import { iconPaths, type IconName } from '@iptv/shared';
import { colors } from '../theme';

export type { IconName };

/** Same 24×24 icon set as the web app (D-041). */
export function Icon({ name, size = 24, color = colors.strong }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={iconPaths[name]} />
    </Svg>
  );
}
