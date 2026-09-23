/** 10-foot UI tokens. Sizes are dp; Android TV renders 1080p at ~960×540 dp. */
export const colors = {
  bg: '#141414',
  surface: '#1f1f1f',
  raised: '#2c2c2c',
  text: '#e5e5e5',
  strong: '#ffffff',
  muted: '#a3a3a3',
  accent: '#e50914',
  success: '#46d369',
  warning: '#e8a33d',
  scrim: 'rgba(0,0,0,0.7)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

/** TV overscan-safe margins. */
export const safe = { horizontal: 48, vertical: 27 } as const;

export const fonts = { hero: 40, title: 28, heading: 20, body: 16, small: 13 } as const;

export const card = { width: 130, height: 195, landscapeWidth: 200, landscapeHeight: 112 } as const;
