import Constants from 'expo-constants';
import { createAppConfig, type EnvSource } from '@iptv/shared';

const extra = (Constants.expoConfig?.extra ?? {}) as EnvSource;

export const appConfig = createAppConfig(extra);

/** Sent to the provider; many panels only answer player-like agents. */
export const providerUserAgent = extra.APP_PROVIDER_USER_AGENT?.trim() || 'VLC/3.0.21 LibVLC/3.0.21';

/** "owner/repo" whose `tv-apk` release has updates (D-062); empty in local and CI emulator builds: no update checks. */
export const updateRepo = extra.APP_UPDATE_REPO?.trim() ?? '';

/** The commit and date this APK was built from (release builds); empty in local builds. Shown in About. */
export const buildInfo = { commit: extra.APP_BUILD_COMMIT?.trim() ?? '', date: extra.APP_BUILD_DATE?.trim() ?? '' };
