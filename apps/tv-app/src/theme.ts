import { useWindowDimensions } from 'react-native';
import { colorTokens, fluidSizes, sizeTokens } from '@iptv/shared';

/** Same tokens as the web app (D-041). Sizes are dp; the web's vw-based sizes come from `useSizes()`. */
export const colors = {
  bg: colorTokens.bg,
  surface: colorTokens.surface,
  raised: colorTokens.surfaceRaised,
  border: colorTokens.border,
  text: colorTokens.text,
  strong: colorTokens.textStrong,
  muted: colorTokens.muted,
  accent: colorTokens.accent,
  success: colorTokens.success,
  warning: colorTokens.warning,
  scrim: 'rgba(0,0,0,0.7)',
  input: '#333',
  secondaryButton: 'rgba(109,109,110,0.7)',
} as const;

export const radius = sizeTokens.radius;
export const navHeight = sizeTokens.navHeight;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

/** Web rem sizes (1rem = 16). */
export const fonts = { hero: 40, title: 28, heading: 20, body: 16, small: 13, tiny: 12 } as const;

/** TV overscan-safe margins (player and full-screen overlays). */
export const safe = { horizontal: 48, vertical: 27 } as const;

/** Legacy fixed card size; lists use `useSizes().cardWidth` like the web grid. */
export const card = { width: 130, height: 195, landscapeWidth: 200, landscapeHeight: 112 } as const;

/** The web's fluid sizes (gutter, card width, titles) for the current screen width. */
export function useSizes() {
  const { width } = useWindowDimensions();
  return fluidSizes(width);
}

/** Visible D-pad focus, like the web's `:focus-visible` outline. */
export const focusRing = { borderColor: colors.strong, borderWidth: 2 } as const;
