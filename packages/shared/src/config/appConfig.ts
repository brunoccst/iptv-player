/** Public, non-secret app settings shared by every client. Source: root `.env`. */
export interface AppConfig {
  appName: string;
  appSlug: string;
  /** Backend address. Empty when the app starts in direct mode without a default server (TV, D-038). */
  apiBaseUrl: string;
}

export type EnvSource = Record<string, string | undefined>;

export class AppConfigError extends Error {
  constructor(missingKeys: string[]) {
    super(`Missing required app config keys: ${missingKeys.join(', ')}. Check the root .env file.`);
    this.name = 'AppConfigError';
  }
}

/** Builds a validated AppConfig from raw env values. Throws AppConfigError if keys are missing. */
export function createAppConfig(env: EnvSource, { requireApiBaseUrl = true }: { requireApiBaseUrl?: boolean } = {}): AppConfig {
  const required = requireApiBaseUrl ? ['APP_NAME', 'APP_SLUG', 'APP_API_BASE_URL'] : ['APP_NAME', 'APP_SLUG'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new AppConfigError(missing);
  }

  return {
    appName: env.APP_NAME!.trim(),
    appSlug: env.APP_SLUG!.trim(),
    apiBaseUrl: (env.APP_API_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  };
}
