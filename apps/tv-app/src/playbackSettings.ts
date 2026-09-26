import { createStore } from 'zustand/vanilla';
import { appLog, errorMessage, type KeyValueStorage } from '@iptv/shared';
import type { AudioDecoderChoice } from '../modules/tv-media';

export const PLAYBACK_SETTINGS_KEY = 'settings.playback';

export interface PlaybackSettingsState {
  audioDecoder: AudioDecoderChoice;
  load(): Promise<void>;
  setAudioDecoder(choice: AudioDecoderChoice): Promise<void>;
}

/** Settings for the player (D-059). Included in backups (D-056), so a reinstall keeps the choice. */
export function createPlaybackSettings(storage: KeyValueStorage) {
  return createStore<PlaybackSettingsState>()((set) => ({
    audioDecoder: 'device',
    async load() {
      try {
        const saved = JSON.parse((await storage.getItem(PLAYBACK_SETTINGS_KEY)) ?? 'null') as { audioDecoder?: string } | null;
        set({ audioDecoder: saved?.audioDecoder === 'ffmpeg' ? 'ffmpeg' : 'device' });
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
