import { createContext, useContext, type ReactNode } from 'react';
import type { View } from 'react-native';
import type { AppContext, AppHooks, DownloadMenuState, IconName, LibrarySection, MasterCard, PinGate, PlayTarget } from '@iptv/shared';

/** One option of a title's menu, as `useTitleCard().menuItems()` gives it. */
export interface TitleMenuItem {
  id: string;
  label: string;
  icon: IconName;
  run(): void;
}

/** One option of a menu the screen opens itself (an episode's "…"); `disabled` ones show but cannot be picked. */
export interface MenuItem extends TitleMenuItem {
  disabled?: boolean;
}

/** A movie or episode's download as this app keeps it: the round button and the episode menu (D-078) show it. */
export interface TitleDownload {
  status: 'none' | 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  /** 0..1 */
  progress: number;
  /** What selecting the button does, for screen readers and the desktop's tooltip. */
  label: string;
  menu: DownloadMenuState;
  /** Start, pause, resume or retry. */
  toggle(): void;
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

/** What an account menu item does: runs at once (after the menu closes), or opens the app's dialog. */
export type MenuAction = { run(): void } | { Dialog(props: { onClose(): void }): ReactNode };

/** A key of the TV remote: `left`, `right`, `select`, `channelUp`, … and whether it went down or up. */
export interface RemoteEvent {
  key: string;
  action: 'down' | 'up' | 'unknown';
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
    | 'useSession'
    | 'useProfilePicker'
    | 'useProfileEditor'
    | 'useReminders'
    | 'useProgrammeDescription'
    | 'useMovieDetails'
    | 'useSeriesDetails'
    | 'useWatchlistToggle'
    | 'useRegroup'
    | 'useMergeCandidates'
    | 'useQualityUpgrades'
    | 'useKidsCategories'
    | 'useHiddenCategories'
    | 'useLanguageSettings'
    | 'usePin'
  >;
  api: AppContext['api'];
  /** Automatic subtitles from OpenSubtitles (D-111): their settings. */
  subtitles: AppContext['subtitles'];
  stores: AppContext['stores'];
  openDetails(section: LibrarySection, masterId: string): void;
  /** Plays a channel, movie or episode (the TV's player screen, the desktop's player over the page). */
  play(target: PlayTarget): void;
  /** Opens a page from a Home row's title or its "See all" card: Movies/Series or Live TV (on a category), or My List. */
  openSection(section: LibrarySection | 'live' | 'mylist', categoryId?: string | null): void;
  /** TV and phone: Home scrolled away from its top (the top nav darkens, like the web's on scroll). */
  setScrolled?(scrolled: boolean): void;
  /** The sign-in page, before any profile (D-088). */
  signIn: {
    appName: string;
    /** Under the form: how the password is kept on this device; `null` for none (a plain browser). Read when drawn (`t`). */
    note(): string | null;
    chooseLanguage(language: string): void;
    /** The app's restore-from-backup dialog, drawn while open. */
    Restore(props: { onClose(): void }): ReactNode;
    /** The code a signed-in phone or tablet scans (D-060, D-178). None where the app cannot pair (a plain browser). */
    DeviceCode?(): ReactNode;
    /** Scanning a signed-in device's code instead, where there is a camera (D-178). */
    scan?: { available(): boolean; open(): void };
  };
  /** Account menu → App → About (D-070): rows of what the app knows about itself, and checking for updates where it can. */
  about: { rows(): [label: string, value: string][]; checkForUpdates?(): void };
  /** The account menu (D-079, DECISIONS.md#d-207): the items only this app has, and the dialogs that stay per app. */
  account: {
    /** Profiles → Parental PIN: the TV's number pad, the desktop's form (D-054). */
    PinSettings(props: { onClose(): void }): ReactNode;
    /** Library & devices → backing up (D-056); the desktop's dialog also restores. */
    backup: MenuAction & { label(): string };
    /** Library & devices → Sync with another device (D-060, D-178); none in a plain browser. */
    sync?: MenuAction & { icon: IconName };
    /** Library & devices → Playback: TV builds with the FFmpeg audio decoders (D-059). */
    playback?: MenuAction | null;
    /** App → Log: the TV's Log page, the desktop's dialog (D-079). */
    log: MenuAction;
    /** TV and phone: closes the app like "Force stop", after asking. */
    closeApp?(): void;
    /** After switching to another profile from the menu. */
    goHome(): void;
  };
  /** "Who's watching?" (D-054): the app's PIN prompt, and signing out. */
  profiles: {
    /** `gate(needed, title, action)` runs `action` at once, or after the PIN when `needed`; `dialog` is the open prompt. */
    usePinGate(): { gate: PinGate; dialog: ReactNode };
    /** Asks first (downloads on this device are deleted, D-050), then signs out. */
    signOut(): void;
  };
  /** My Downloads: the downloads, newest first, and notes above them (desktop: no offline support, storage used). */
  useDownloads(): { entries: DownloadEntry[]; notes: string[] };
  /** The top nav's search box: its text and, on TV, how many times Enter was pressed (search at once, D-079). */
  useSearch(): { text: string; submits?: number };
  /** The category chosen on the Movies/Series page (`null`: All), kept in the app's navigation. */
  useCategory(): string | null;
  setCategory(categoryId: string | null): void;
  /** TV: the remote's keys while the screen is shown, as down/up pairs (D-028). None on the desktop. */
  useRemote?(handler: (event: RemoteEvent) => void): void;
  /** TV: where Up from the top of a page goes, the current page's link in the top nav. */
  useNavFocusTarget?(): View | undefined;
  /** Desktop: a reminder is about to be set; asks once to show system notifications while the window is away (issue #239). */
  allowReminders?(): void;
  /** A title's details (D-069): how they close and the buttons only this app has. */
  details: {
    close(): void;
    /** Goes up when the library was read again, so the open details load again. */
    useRevision(): number;
    /** A movie or episode's download, where this app can download it (D-050); `null` where it cannot. */
    useDownload(target: PlayTarget, durationSeconds?: number | null): TitleDownload | null;
    /** Phones with a paired TV (D-061): starting the title there; `null` without one. */
    usePlayOnTv?(target: PlayTarget | null): { tvName: string; label: string; play(): void } | null;
    /** Another player app, or VLC on the desktop (D-057); `null` where there is none (Kids profiles, a plain browser). */
    useExternalPlayer(target: PlayTarget): { kind: 'app' | 'vlc'; label: string; open(): void } | null;
    /** Shows another title's details in place of these: where a split or merge left the title (issue #243). */
    replace(section: LibrarySection, masterId: string): void;
    /** TV: the title the remote's Red key adds to My List while no card has the focus (D-154). */
    usePageTitle?(section: LibrarySection, title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>): void;
    /**
     * Desktop: the app's dialog the details are drawn in (Escape, a click beside it and its close button close it).
     * TV and phone: none, the screen draws its own panel. `split`: two columns over the whole window (D-158).
     */
    Frame?(props: { label: string; split: boolean; onClose(): void; children: ReactNode }): ReactNode;
  };
  /** A menu the screen opens itself (an episode's "…"); desktop: under `anchor`, the button it came from. */
  Menu(props: { title: string; subtitle?: string | null; items: MenuItem[]; anchor?: View; onClose(): void }): ReactNode;
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
