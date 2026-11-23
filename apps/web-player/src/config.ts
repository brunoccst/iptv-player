import { createAppConfig } from '@iptv/shared';

export const appConfig = createAppConfig(import.meta.env);

/** Sent to the provider; many panels only answer player-like agents. */
export const providerUserAgent = import.meta.env.VITE_PROVIDER_USER_AGENT?.trim() || 'VLC/3.0.21 LibVLC/3.0.21';
