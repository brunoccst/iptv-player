import { createStore } from 'zustand/vanilla';
import { appLog, errorMessage, type KeyValueStorage } from '@iptv/shared';
import type { AudioDecoderChoice } from '../modules/tv-media';

export const PLAYBACK_SETTINGS_KEY = 'settings.playback';

export interface PlaybackSettingsState {
  audioDecoder: AudioDecoderChoice;
  load(): Promise<void>;
  setAudioDecoder(choice: AudioDecoderChoice): Promise<void>;
}

/** Device settings for the player (D-059). Kept on this device only, not in backups: they depend on its hardware. */
export function createPlaybackSettings(storage: KeyValueStorage) {
  return createStore<PlaybackSettingsState>()((set) => ({
    audioDecoder: 'auto',
    async load() {
      try {
        const saved = JSON.parse((await storage.getItem(PLAYBACK_SETTINGS_KEY)) ?? 'null') as { audioDecoder?: string } | null;
        if (saved?.audioDecoder === 'device' || saved?.audioDecoder === 'ffmpeg') set({ audioDecoder: saved.audioDecoder });
      } catch (error) {
        appLog.warn('settings', `playback settings unreadable: ${errorMessage(error)}`);
      }
    },
    async setAudioDecoder(audioDecoder) {
      set({ audioDecoder });
      await storage.setItem(PLAYBACK_SETTINGS_KEY, JSON.stringify({ audioDecoder }));
      appLog.info('settings', `audio decoder: ${audioDecoder}`);
    },
  }));
}

export type PlaybackSettingsStore = ReturnType<typeof createPlaybackSettings>;
