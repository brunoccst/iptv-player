import { useAppStore } from '@iptv/shared';
import type { CatalogState, LibraryState, ProgressState, SessionState } from '@iptv/shared';
import { downloadsStore, navStore, stores } from './appContext';
import type { DownloadsState } from './downloads/downloadsStore';
import type { NavState } from './navigation/navStore';

export const useSession = <T,>(selector: (state: SessionState) => T) => useAppStore(stores.session, selector);
export const useCatalog = <T,>(selector: (state: CatalogState) => T) => useAppStore(stores.catalog, selector);
export const useLibrary = <T,>(selector: (state: LibraryState) => T) => useAppStore(stores.library, selector);
export const useProgress = <T,>(selector: (state: ProgressState) => T) => useAppStore(stores.progress, selector);
export const useDownloads = <T,>(selector: (state: DownloadsState) => T) => useAppStore(downloadsStore, selector);
export const useNav = <T,>(selector: (state: NavState) => T) => useAppStore(navStore, selector);
