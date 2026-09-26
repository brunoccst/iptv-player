import { createAppConfig } from '@iptv/shared';
import { desktop } from './desktop';

/** The desktop app talks to the IPTV provider directly (D-071): no backend address needed there. */
export const appConfig = createAppConfig(import.meta.env, { requireApiBaseUrl: !desktop });
