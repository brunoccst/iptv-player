/** Public, non-secret app settings shared by every client. Source: root `.env`. */
export interface AppConfig {
  appName: string;
  appSlug: string;
}

export type EnvSource = Record<string, string | undefined>;

export class AppConfigError extends Error {
  constructor(missingKeys: string[]) {
    super(`Missing required app config keys: ${missingKeys.join(', ')}. Check the root .env file.`);
    this.name = 'AppConfigError';
  }
}

/** Builds a validated AppConfig from raw env values. Throws AppConfigError if keys are missing. */
export function createAppConfig(env: EnvSource): AppConfig {
  const missing = ['APP_NAME', 'APP_SLUG'].filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new AppConfigError(missing);
  }
  return { appName: env.APP_NAME!.trim(), appSlug: env.APP_SLUG!.trim() };
}
