import { describe, expect, it } from 'vitest';
import { sharedScreensOn } from './sharedScreens';

describe('the React Native Web trial switch (issue #237)', () => {
  it('turns on with ?screens=shared, stays on, and goes back with ?screens=web', () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    expect(sharedScreensOn('', storage)).toBe(false);
    expect(sharedScreensOn('?screens=shared', storage)).toBe(true);
    expect(sharedScreensOn('', storage)).toBe(true);
    expect(sharedScreensOn('?screens=web', storage)).toBe(false);
    expect(sharedScreensOn('?other=1', storage)).toBe(false);
  });

  it('works without storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(sharedScreensOn('?screens=shared', broken)).toBe(true);
    expect(sharedScreensOn('', null)).toBe(false);
  });
});
