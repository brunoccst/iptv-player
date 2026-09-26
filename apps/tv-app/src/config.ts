import Constants from 'expo-constants';
import { createAppConfig, type EnvSource } from '@iptv/shared';

const extra = (Constants.expoConfig?.extra ?? {}) as EnvSource;

/** `APP_API_BASE_URL` is optional on TV: it only prefills "My server" (D-038). */
export const appConfig = createAppConfig(extra, { requireApiBaseUrl: false });

/** Sent to the provider in direct mode; many panels only answer player-like agents. */
export const providerUserAgent = extra.APP_PROVIDER_USER_AGENT?.trim() || 'VLC/3.0.21 LibVLC/3.0.21';

/** "owner/repo" whose `tv-apk` release has updates (D-062); empty in local and CI emulator builds: no update checks. */
export const updateRepo = extra.APP_UPDATE_REPO?.trim() ?? '';

/** The commit and date this APK was built from (release builds); empty in local builds. Shown in About. */
export const buildInfo = { commit: extra.APP_BUILD_COMMIT?.trim() ?? '', date: extra.APP_BUILD_DATE?.trim() ?? '' };
