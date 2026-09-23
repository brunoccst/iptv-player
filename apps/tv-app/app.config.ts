import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Root .env is the single config source; .env.local overrides it. See DECISIONS.md#d-003.
const repoRoot = path.resolve(__dirname, '../..');
loadEnv({ path: [path.join(repoRoot, '.env.local'), path.join(repoRoot, '.env')], quiet: true });

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key} in root .env`);
  }
  return value;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: requireEnv('APP_NAME'),
  slug: requireEnv('APP_SLUG'),
  version: '0.0.0',
  orientation: 'landscape',
  userInterfaceStyle: 'dark',
  backgroundColor: '#141414',
  platforms: ['android'],
  android: {
    package: requireEnv('APP_ANDROID_PACKAGE'),
  },
  plugins: [['@react-native-tvos/config-tv', { isTV: true }]],
  extra: {
    APP_NAME: requireEnv('APP_NAME'),
    APP_SLUG: requireEnv('APP_SLUG'),
    APP_API_BASE_URL: requireEnv('APP_API_BASE_URL'),
  },
});
