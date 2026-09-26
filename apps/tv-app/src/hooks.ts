import { offlineAccess, useAppStore } from '@iptv/shared';
import type {
  CatalogState,
  ConnectionState,
  LibraryState,
  PinState,
  ProfilePrefsState,
  ProgressState,
  SessionState,
  WatchlistState,
} from '@iptv/shared';
import { downloadsStore, navStore, playbackSettings, stores } from './appContext';
import type { DownloadsState } from './downloads/downloadsStore';
import type { NavState } from './navigation/navStore';
import type { PlaybackSettingsState } from './playbackSettings';

export const useSession = <T>(selector: (state: SessionState) => T) => useAppStore(stores.session, selector);
/** The TV context always enables direct mode, so `connection` exists. */
export const connectionStore = stores.connection!;
export const useConnection = <T>(selector: (state: ConnectionState) => T) => useAppStore(connectionStore, selector);
export const useCatalog = <T>(selector: (state: CatalogState) => T) => useAppStore(stores.catalog, selector);
export const useLibrary = <T>(selector: (state: LibraryState) => T) => useAppStore(stores.library, selector);
export const useProgress = <T>(selector: (state: ProgressState) => T) => useAppStore(stores.progress, selector);
export const useDownloads = <T>(selector: (state: DownloadsState) => T) => useAppStore(downloadsStore, selector);
export const useWatchlist = <T>(selector: (state: WatchlistState) => T) => useAppStore(stores.watchlist, selector);
export const useProfilePrefs = <T>(selector: (state: ProfilePrefsState) => T) => useAppStore(stores.profilePrefs, selector);
export const usePin = <T>(selector: (state: PinState) => T) => useAppStore(stores.pin, selector);
export const useNav = <T>(selector: (state: NavState) => T) => useAppStore(navStore, selector);
export const usePlaybackSettings = <T>(selector: (state: PlaybackSettingsState) => T) => useAppStore(playbackSettings, selector);

/** Whether downloads may play (subscription active, online within 30 days). D-050. */
export function useOfflineAccess() {
  const expiresAt = useSession((s) => s.account?.expiresAt ?? null);
  const lastOnlineAt = useSession((s) => s.lastOnlineAt);
  return offlineAccess({ expiresAt }, lastOnlineAt);
}
