import { createAppHooks, useAppStore } from '@iptv/shared';
import { api, downloadsStore, stores, uiStore } from '../appContext';
import type { DownloadsState } from '../offline/downloadsStore';
import type { UiState } from '../ui/uiStore';

export const {
  useSession,
  useCatalog,
  useLibrary,
  useProgress,
  useWatchlist,
  useProfilePrefs,
  usePin,
  useOfflineAccess,
  usePagedLibrary,
  useProfilePicker,
  useProfileEditor,
  useMovieDetails,
  useSeriesDetails,
  useKidsCategories,
  useHiddenCategories,
  useLanguageSettings,
  useChannelSearch,
  useProgrammeSearch,
  useWatchlistToggle,
  usePlayerTitle,
  useHeroTitle,
  useTitleCard,
  continueMenuItems,
} = createAppHooks({ api, stores, reloadLists: () => uiStore.getState().bumpLibrary() });
export const useDownloads = <T>(selector: (state: DownloadsState) => T) => useAppStore(downloadsStore, selector);
export const useUi = <T>(selector: (state: UiState) => T) => useAppStore(uiStore, selector);
