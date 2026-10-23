import { createContext, useContext, type ReactNode } from 'react';
import type { AppContext, AppHooks, IconName, LibrarySection, MasterCard, PlayTarget } from '@iptv/shared';

/** One option of a title's menu, as `useTitleCard().menuItems()` gives it. */
export interface TitleMenuItem {
  id: string;
  label: string;
  icon: IconName;
  run(): void;
}

/** One download on My Downloads, from the app's own downloads store (the TV's native downloader, the desktop's cache). */
export interface DownloadEntry {
  id: string;
  title: string;
  subtitle?: string | null;
  posterUrl?: string | null;
  /** Tried when `posterUrl` does not load (desktop: the saved copy first, then the provider's). */
  posterFallback?: string | null;
  /** `unknown`: the TV's downloader cannot say (Resume tries again). */
  state: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'unknown';
  /** 0..1 */
  progress: number;
  bytesDownloaded: number;
  /** Why it failed, when the app knows. */
  error?: string | null;
  play(): void;
  pause(): void;
  resume(): void;
  remove(): void;
}

/**
 * What an app brings to the shared screens (issue #237, DECISIONS.md#d-193): its stores (through the shared hooks), how
 * details open, how a page scrolls and how a title's menu opens. TV/phone: a focus page, hold OK for a pop-up menu and
 * the remote's colour keys. Desktop: the window scrolls and a right-click opens a menu at the pointer.
 */
export interface ScreenHost {
  hooks: Pick<
    AppHooks,
    | 'useTitleCard'
    | 'useWatchlist'
    | 'usePagedLibrary'
    | 'useCatalog'
    | 'useLibrary'
    | 'useProgress'
    | 'useChannelSearch'
    | 'useProgrammeSearch'
    | 'useHeroTitle'
    | 'useLiveHomeRow'
    | 'continueMenuItems'
    | 'useOfflineAccess'
  >;
  stores: Pick<AppContext['stores'], 'catalog' | 'library'>;
  openDetails(section: LibrarySection, masterId: string): void;
  /** Plays a channel, movie or episode (the TV's player screen, the desktop's player over the page). */
  play(target: PlayTarget): void;
  /** Opens a page from a Home row's title or its "See all" card: Movies/Series or Live TV (on a category), or My List. */
  openSection(section: LibrarySection | 'live' | 'mylist', categoryId?: string | null): void;
  /** TV and phone: Home scrolled away from its top (the top nav darkens, like the web's on scroll). */
  setScrolled?(scrolled: boolean): void;
  /** My Downloads: the downloads, newest first, and notes above them (desktop: no offline support, storage used). */
  useDownloads(): { entries: DownloadEntry[]; notes: string[] };
  /** The top nav's search box: its text and, on TV, how many times Enter was pressed (search at once, D-079). */
  useSearch(): { text: string; submits?: number };
  /** The category chosen on the Movies/Series page (`null`: All), kept in the app's navigation. */
  useCategory(): string | null;
  setCategory(categoryId: string | null): void;
  /** The scrolling page under the top nav; `children` are the title and the rows. */
  Page(props: { children: ReactNode; testID: string }): ReactNode;
  /**
   * Wraps a title's card with its menu. `children` gets `openMenu` for the card's long press (hold OK on TV); the desktop
   * opens it on a right-click and gives none.
   */
  TitleMenu(props: {
    title: string;
    subtitle?: string | null;
    items: () => TitleMenuItem[];
    children(openMenu?: () => void): ReactNode;
  }): ReactNode;
  /**
   * Desktop: shown at the end of a grid while more titles can load; calls `onReached` when it comes into view (the
   * window scrolls there). TV and phone grids scroll on their own and need none.
   */
  EndSensor?(props: { onReached(): void }): ReactNode;
  /** A title card got or lost the focus (the TV remote's Red key adds the focused title to My List, D-154). */
  focusTitle?(section: LibrarySection, card: MasterCard): void;
  blurTitle?(id: string): void;
}

const HostContext = createContext<ScreenHost | null>(null);
let appHost: ScreenHost | null = null;

/** Each app sets its host once, when it loads; a screen can also get one from a `ScreenHostProvider` (tests). */
export function setScreenHost(host: ScreenHost) {
  appHost = host;
}
export const ScreenHostProvider = HostContext.Provider;

export function useScreenHost(): ScreenHost {
  const host = useContext(HostContext) ?? appHost;
  if (!host) throw new Error('A shared screen needs the app to call setScreenHost first');
  return host;
}
