import { createAppHooks, useAppStore } from '@iptv/shared';
import { downloadsStore, navStore, playbackSettings, stores } from './appContext';
import type { DownloadsState } from './downloads/downloadsStore';
import type { NavState } from './navigation/navStore';
import type { PlaybackSettingsState } from './playbackSettings';

export const { useSession, useCatalog, useLibrary, useProgress, useWatchlist, useProfilePrefs, usePin, useOfflineAccess, usePagedLibrary } =
  createAppHooks(stores);
export const useDownloads = <T>(selector: (state: DownloadsState) => T) => useAppStore(downloadsStore, selector);
export const useNav = <T>(selector: (state: NavState) => T) => useAppStore(navStore, selector);
export const usePlaybackSettings = <T>(selector: (state: PlaybackSettingsState) => T) => useAppStore(playbackSettings, selector);
