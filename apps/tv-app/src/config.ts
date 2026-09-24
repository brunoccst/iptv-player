import Constants from 'expo-constants';
import { createAppConfig, type EnvSource } from '@iptv/shared';

const extra = (Constants.expoConfig?.extra ?? {}) as EnvSource;

/** `APP_API_BASE_URL` is optional on TV: it only prefills "My server" (D-038). */
export const appConfig = createAppConfig(extra, { requireApiBaseUrl: false });

/** Sent to the provider in direct mode; many panels only answer player-like agents. */
export const providerUserAgent = extra.APP_PROVIDER_USER_AGENT?.trim() || 'VLC/3.0.21 LibVLC/3.0.21';
