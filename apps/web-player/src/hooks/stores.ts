import { useAppStore } from '@iptv/shared';
import type { CatalogState, LibraryState, PlayerState, ProgressState, SessionState } from '@iptv/shared';
import { downloadsStore, stores, uiStore } from '../appContext';
import type { DownloadsState } from '../offline/downloadsStore';
import type { UiState } from '../ui/uiStore';

export const useSession = <T>(selector: (state: SessionState) => T) => useAppStore(stores.session, selector);
export const useCatalog = <T>(selector: (state: CatalogState) => T) => useAppStore(stores.catalog, selector);
export const useLibrary = <T>(selector: (state: LibraryState) => T) => useAppStore(stores.library, selector);
export const usePlayer = <T>(selector: (state: PlayerState) => T) => useAppStore(stores.player, selector);
export const useProgress = <T>(selector: (state: ProgressState) => T) => useAppStore(stores.progress, selector);
export const useDownloads = <T>(selector: (state: DownloadsState) => T) => useAppStore(downloadsStore, selector);
export const useUi = <T>(selector: (state: UiState) => T) => useAppStore(uiStore, selector);
