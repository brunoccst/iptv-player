import { createStore } from 'zustand/vanilla';
import type { LibrarySection, PlayTarget } from '@iptv/shared';

export type { PlayTarget } from '@iptv/shared';

export type View = 'home' | 'movies' | 'series' | 'live' | 'downloads' | 'search';

export interface DetailsTarget {
  section: LibrarySection;
  masterId: string;
}

interface UiSnapshot {
  view: View;
  /** Category chip on the Movies/Series page (`null` = All). */
  categoryId: string | null;
  search: string;
  details: DetailsTarget | null;
  playing: PlayTarget | null;
}

export interface UiState extends UiSnapshot {
  /** Bumped when the library finished re-processing; rows reload when it changes. */
  libraryRevision: number;
  bumpLibrary(): void;
  navigate(view: View): void;
  /** Movies/Series page filtered to one category (row title links on Home). */
  openCategory(section: LibrarySection, categoryId: string | null): void;
  setCategory(categoryId: string | null): void;
  setSearch(query: string): void;
  openDetails(target: DetailsTarget): void;
  closeDetails(): void;
  play(target: PlayTarget): void;
  /** Replaces the current item without a new history entry (next episode, version switch). */
  replacePlayback(target: PlayTarget): void;
  stopPlayback(): void;
}

const initial: UiSnapshot = { view: 'home', categoryId: null, search: '', details: null, playing: null };

/** Navigation state mirrored into browser history so Back closes the player/modal. See DECISIONS.md#d-025. */
export function createUiStore(history: History | null = typeof window !== 'undefined' ? window.history : null) {
  const store = createStore<UiState>()((set, get) => {
    const snapshot = (): UiSnapshot => {
      const { view, categoryId, search, details, playing } = get();
      return { view, categoryId, search, details, playing };
    };
    const push = (next: Partial<UiSnapshot>) => {
      set(next);
      history?.pushState({ ui: snapshot() }, '');
    };

    return {
      ...initial,
      libraryRevision: 0,
      bumpLibrary: () => set({ libraryRevision: get().libraryRevision + 1 }),
      navigate: (view) => push({ view, categoryId: null, details: null, playing: null }),
      openCategory: (section, categoryId) => push({ view: section, categoryId, details: null, playing: null }),
      setCategory: (categoryId) => {
        set({ categoryId });
        history?.replaceState({ ui: snapshot() }, '');
      },
      setSearch: (search) => {
        set({ search, view: search.trim() ? 'search' : get().view === 'search' ? 'home' : get().view });
        history?.replaceState({ ui: snapshot() }, '');
      },
      openDetails: (details) => push({ details }),
      closeDetails: () => (history && get().details ? history.back() : set({ details: null })),
      play: (playing) => push({ playing }),
      replacePlayback: (playing) => {
        set({ playing });
        history?.replaceState({ ui: snapshot() }, '');
      },
      stopPlayback: () => (history && get().playing ? history.back() : set({ playing: null })),
    };
  });

  if (typeof window !== 'undefined' && history) {
    history.replaceState({ ui: initial }, '');
    window.addEventListener('popstate', (event) => {
      const ui = (event.state as { ui?: UiSnapshot } | null)?.ui ?? initial;
      store.setState({ ...ui });
    });
  }
  return store;
}

export type UiStore = ReturnType<typeof createUiStore>;
