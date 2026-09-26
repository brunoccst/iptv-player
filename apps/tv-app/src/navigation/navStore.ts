import { createStore } from 'zustand/vanilla';
import type { LibrarySection, PlayTarget } from '@iptv/shared';

/** Same pages as the web top nav, plus Log (account menu). */
export type Section = 'home' | 'search' | 'movies' | 'series' | 'live' | 'mylist' | 'downloads' | 'log';

export type Route =
  | { name: 'section'; section: Section }
  | { name: 'details'; section: LibrarySection; masterId: string }
  | { name: 'player'; target: PlayTarget };

export interface NavState {
  stack: Route[];
  /** Bumped when the library finished (re)processing; rows remount and reload. */
  libraryRevision: number;
  /** Search box text in the top nav (web: `uiStore.search`). */
  search: string;
  /** Bumped when the search box's Enter key is pressed: search now, without waiting for typing to pause. */
  searchSubmits: number;
  /** Category chip on Movies/Series, or the Live TV category (`null` = All), like the web `uiStore.categoryId`. */
  categoryId: string | null;
  /** Home scrolled: the nav gets a solid background (web `.nav--solid`). */
  scrolled: boolean;
  /** Account menu under the avatar. */
  menuOpen: boolean;
  /** The account menu's open group ("Profiles", "Library & devices", …); `null` = the main list. */
  menuGroup: string | null;
  bumpLibrary(): void;
  goSection(section: Section): void;
  /** Movies/Series/Live TV filtered to one category (Home row title links and arrow cards). */
  openCategory(section: LibrarySection | 'live', categoryId: string | null): void;
  setCategory(categoryId: string | null): void;
  /** Typing switches to the Search page; clearing it goes back Home (web behaviour). */
  setSearch(search: string): void;
  submitSearch(): void;
  setScrolled(scrolled: boolean): void;
  setMenuOpen(open: boolean): void;
  setMenuGroup(group: string | null): void;
  push(route: Route): void;
  /** Swaps the top route (next episode, version switch) without growing the stack. */
  replaceTop(route: Route): void;
  /** Leaves a menu group, closes the menu or pops one route. Returns false at the root so Android can exit the app. */
  back(): boolean;
}

/** Stack navigation: root is a page from the top nav; details and player are pushed on top. See DECISIONS.md#d-028, #d-041. */
export function createNavStore() {
  return createStore<NavState>()((set, get) => ({
    stack: [{ name: 'section', section: 'home' }],
    libraryRevision: 0,
    search: '',
    searchSubmits: 0,
    categoryId: null,
    scrolled: false,
    menuOpen: false,
    menuGroup: null,
    bumpLibrary: () => set({ libraryRevision: get().libraryRevision + 1 }),
    goSection: (section) =>
      set({
        stack: [{ name: 'section', section }],
        categoryId: null,
        menuOpen: false,
        scrolled: false,
        ...(section === 'search' ? {} : { search: '' }),
      }),
    openCategory: (section, categoryId) =>
      set({ stack: [{ name: 'section', section }], categoryId, search: '', menuOpen: false, scrolled: false }),
    setCategory: (categoryId) => set({ categoryId }),
    setSearch: (search) => {
      const section = currentSection(get());
      if (search.trim()) set({ search, stack: section === 'search' ? get().stack : [{ name: 'section', section: 'search' }] });
      else set({ search, stack: section === 'search' ? [{ name: 'section', section: 'home' }] : get().stack });
    },
    submitSearch: () => set({ searchSubmits: get().searchSubmits + 1 }),
    setScrolled: (scrolled) => {
      if (get().scrolled !== scrolled) set({ scrolled });
    },
    setMenuOpen: (menuOpen) => set({ menuOpen, menuGroup: null }),
    setMenuGroup: (menuGroup) => set({ menuGroup }),
    push: (route) => set({ stack: [...get().stack, route], menuOpen: false }),
    replaceTop: (route) => set({ stack: [...get().stack.slice(0, -1), route] }),
    back: () => {
      const { stack, menuOpen, menuGroup } = get();
      if (menuOpen && menuGroup) {
        set({ menuGroup: null });
        return true;
      }
      if (menuOpen) {
        set({ menuOpen: false });
        return true;
      }
      if (stack.length <= 1) return false;
      set({ stack: stack.slice(0, -1) });
      return true;
    },
  }));
}

export type NavStore = ReturnType<typeof createNavStore>;
export const currentRoute = (state: NavState): Route => state.stack[state.stack.length - 1]!;
/** Page shown under any pushed details/player routes. */
export const currentSection = (state: NavState): Section => {
  const root = state.stack[0];
  return root?.name === 'section' ? root.section : 'home';
};
