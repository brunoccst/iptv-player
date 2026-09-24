import { createStore } from 'zustand/vanilla';
import type { LibrarySection, PlayTarget } from '@iptv/shared';

export type Section = 'home' | 'movies' | 'series' | 'live' | 'downloads';

export type Route =
  | { name: 'section'; section: Section }
  | { name: 'details'; section: LibrarySection; masterId: string }
  | { name: 'player'; target: PlayTarget };

export interface NavState {
  stack: Route[];
  /** Bumped when the library finished (re)processing; rows remount and reload. */
  libraryRevision: number;
  /** Side menu reduced to its ☰ button (more room on phones). */
  railCollapsed: boolean;
  setRailCollapsed(collapsed: boolean): void;
  bumpLibrary(): void;
  goSection(section: Section): void;
  push(route: Route): void;
  /** Swaps the top route (next episode, version switch) without growing the stack. */
  replaceTop(route: Route): void;
  /** Pops one route. Returns false at the root so Android can exit the app. */
  back(): boolean;
}

/** Stack navigation for the TV app: root is a section; details and player are pushed on top. See DECISIONS.md#d-028. */
export function createNavStore() {
  return createStore<NavState>()((set, get) => ({
    stack: [{ name: 'section', section: 'home' }],
    libraryRevision: 0,
    railCollapsed: false,
    setRailCollapsed: (railCollapsed) => set({ railCollapsed }),
    bumpLibrary: () => set({ libraryRevision: get().libraryRevision + 1 }),
    goSection: (section) => set({ stack: [{ name: 'section', section }] }),
    push: (route) => set({ stack: [...get().stack, route] }),
    replaceTop: (route) => set({ stack: [...get().stack.slice(0, -1), route] }),
    back: () => {
      const { stack } = get();
      if (stack.length <= 1) return false;
      set({ stack: stack.slice(0, -1) });
      return true;
    },
  }));
}

export type NavStore = ReturnType<typeof createNavStore>;
export const currentRoute = (state: NavState): Route => state.stack[state.stack.length - 1]!;
