import Constants from 'expo-constants';
import { createAppConfig, type EnvSource } from '@iptv/shared';

export const appConfig = createAppConfig((Constants.expoConfig?.extra ?? {}) as EnvSource);
