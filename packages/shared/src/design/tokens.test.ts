import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colorTokens, fluidSizes } from './tokens';

describe('design tokens', () => {
  it('match the web CSS custom properties, so the TV app looks the same', () => {
    const css = readFileSync(new URL('../../../../apps/web-player/src/styles/global.css', import.meta.url), 'utf8');
    const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    for (const [name, value] of Object.entries(colorTokens)) expect(css).toContain(`--color-${kebab(name)}: ${value};`);
    expect(css).toContain('--gutter: clamp(16px, 4vw, 60px);');
    expect(css).toContain('--card-width: clamp(120px, 14vw, 200px);');
  });

  it('computes the fluid sizes like CSS clamp()', () => {
    expect(fluidSizes(915)).toMatchObject({ gutter: 37, cardWidth: 128 });
    expect(fluidSizes(1920)).toMatchObject({ gutter: 60, cardWidth: 200 });
    expect(fluidSizes(320)).toMatchObject({ gutter: 16, cardWidth: 120 });
  });
});
