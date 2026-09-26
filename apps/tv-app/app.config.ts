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
  // Rendered by scripts/render-icons.mjs from one design (web uses the same).
  icon: './assets/icon.png',
  android: {
    package: requireEnv('APP_ANDROID_PACKAGE'),
    // tv-apk.yml passes its run number so each APK counts as a newer version (D-052).
    versionCode: Number(process.env.APP_ANDROID_VERSION_CODE) || 1,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#141414' },
  },
  plugins: [
    ['@react-native-tvos/config-tv', { isTV: true, androidTVBanner: './assets/tv-banner.png' }],
    // Native launch screen: the icon on the dark background until the first frame.
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#141414' }],
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          // The local backend is plain HTTP on the LAN (KI-009); Android blocks cleartext by default.
          usesCleartextTraffic: true,
          // Smaller APK (D-045): compress native libraries, strip unused Java code (R8) and resources.
          useLegacyPackaging: true,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    './plugins/withReleaseSigning.js',
  ],
  extra: {
    APP_NAME: requireEnv('APP_NAME'),
    APP_SLUG: requireEnv('APP_SLUG'),
    // Optional: prefills "My server". Without it the app starts in direct mode only (D-038).
    APP_API_BASE_URL: process.env.APP_API_BASE_URL?.trim() ?? '',
    APP_PROVIDER_USER_AGENT: process.env.BACKEND_PROVIDER_USER_AGENT?.trim() ?? '',
    // Optional: '1' logs every remote event (used by the emulator CI build).
    APP_TV_DEBUG_REMOTE: process.env.APP_TV_DEBUG_REMOTE ?? '',
    // Optional: "owner/repo" whose tv-apk release the app checks for updates (tv-apk.yml sets it; D-062).
    APP_UPDATE_REPO: process.env.APP_UPDATE_REPO?.trim() ?? '',
    // Optional: shown under account menu → About. tv-apk.yml sets the commit it builds; the date is the build's.
    APP_BUILD_COMMIT: process.env.APP_BUILD_COMMIT?.trim() ?? '',
    APP_BUILD_DATE: process.env.APP_BUILD_COMMIT ? new Date().toISOString() : '',
  },
});
