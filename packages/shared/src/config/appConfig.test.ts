import { describe, expect, it } from 'vitest';
import { AppConfigError, createAppConfig } from './appConfig';

const validEnv = {
  APP_NAME: ' Test App ',
  APP_SLUG: 'test-app',
  APP_API_BASE_URL: 'https://api.example.com//',
};

describe('createAppConfig', () => {
  it('maps and trims env values', () => {
    expect(createAppConfig(validEnv)).toEqual({
      appName: 'Test App',
      appSlug: 'test-app',
      apiBaseUrl: 'https://api.example.com',
    });
  });

  it('throws listing every missing key', () => {
    expect(() => createAppConfig({ APP_NAME: '  ' })).toThrow(AppConfigError);
    expect(() => createAppConfig({})).toThrow(/APP_NAME, APP_SLUG, APP_API_BASE_URL/);
  });

  it('allows a missing API address when the app can run in direct mode', () => {
    expect(createAppConfig({ APP_NAME: 'A', APP_SLUG: 'a' }, { requireApiBaseUrl: false }).apiBaseUrl).toBe('');
  });
});
