/**
 * Design tokens shared by the web app (CSS custom properties in apps/web-player/src/styles/global.css)
 * and the TV/phone app (apps/tv-app/src/theme.ts), so both look the same. See DECISIONS.md#d-041.
 */
export const colorTokens = {
  bg: '#141414',
  surface: '#181818',
  surfaceRaised: '#232323',
  border: '#333',
  text: '#e5e5e5',
  textStrong: '#fff',
  muted: '#a3a3a3',
  accent: '#e50914',
  accentHover: '#f6121d',
  success: '#46d369',
  warning: '#e8a33d',
} as const;

export const sizeTokens = {
  radius: 4,
  navHeight: 68,
} as const;

/** CSS `clamp(min, vw% of the viewport, max)`: the web's fluid sizes, computed for a native screen width. */
export const fluid = (viewportWidth: number, min: number, vw: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, (viewportWidth * vw) / 100)));

/** The web's viewport-based sizes (`--gutter`, `--card-width`, …) for a given screen width in px/dp. */
export function fluidSizes(viewportWidth: number) {
  return {
    gutter: fluid(viewportWidth, 16, 4, 60),
    cardWidth: fluid(viewportWidth, 120, 14, 200),
    brand: fluid(viewportWidth, 19, 2, 29),
    heroTitle: fluid(viewportWidth, 32, 5, 72),
    heroPlot: fluid(viewportWidth, 14, 1.2, 19),
    pageTitle: fluid(viewportWidth, 22, 2.5, 32),
    rowTitle: fluid(viewportWidth, 16, 1.4, 22),
    rowGap: Math.round(viewportWidth * 0.03),
    navGap: fluid(viewportWidth, 12, 2, 32),
    navLinkGap: fluid(viewportWidth, 8, 1.5, 20),
    search: fluid(viewportWidth, 120, 18, 260),
  };
}
