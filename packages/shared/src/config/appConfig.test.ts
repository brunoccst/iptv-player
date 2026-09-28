import { describe, expect, it } from 'vitest';
import { AppConfigError, createAppConfig } from './appConfig';

describe('createAppConfig', () => {
  it('maps and trims env values', () => {
    expect(createAppConfig({ APP_NAME: ' Test App ', APP_SLUG: 'test-app' })).toEqual({ appName: 'Test App', appSlug: 'test-app' });
  });

  it('throws listing every missing key', () => {
    expect(() => createAppConfig({ APP_NAME: '  ' })).toThrow(AppConfigError);
    expect(() => createAppConfig({})).toThrow(/APP_NAME, APP_SLUG/);
  });
});
