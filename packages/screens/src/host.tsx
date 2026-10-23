import { createContext, useContext, type ReactNode } from 'react';
import type { AppHooks, IconName, LibrarySection, MasterCard } from '@iptv/shared';

/** One option of a title's menu, as `useTitleCard().menuItems()` gives it. */
export interface TitleMenuItem {
  id: string;
  label: string;
  icon: IconName;
  run(): void;
}

/**
 * What an app brings to the shared screens (issue #237, DECISIONS.md#d-193): its stores (through the shared hooks), how
 * details open, how a page scrolls and how a title's menu opens. TV/phone: a focus page, hold OK for a pop-up menu and
 * the remote's colour keys. Desktop: the window scrolls and a right-click opens a menu at the pointer.
 */
export interface ScreenHost {
  hooks: Pick<AppHooks, 'useTitleCard' | 'useWatchlist'>;
  openDetails(section: LibrarySection, masterId: string): void;
  /** The scrolling page under the top nav; `children` are the title and the rows. */
  Page(props: { children: ReactNode; testID: string }): ReactNode;
  /**
   * Wraps a title's card with its menu. `children` gets `openMenu` for the card's long press (hold OK on TV); the desktop
   * opens it on a right-click and gives none.
   */
  TitleMenu(props: { title: string; items: () => TitleMenuItem[]; children(openMenu?: () => void): ReactNode }): ReactNode;
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
