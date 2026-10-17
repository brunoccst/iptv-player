import { createStore } from 'zustand/vanilla';
import type { LibrarySection, PlayTarget } from '@iptv/shared';

export type { PlayTarget } from '@iptv/shared';

export type View = 'home' | 'movies' | 'series' | 'live' | 'mylist' | 'downloads' | 'search';

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
  /** Shows other details in place of the open ones, without a new history entry (after a split or merge). */
  replaceDetails(target: DetailsTarget): void;
  closeDetails(): void;
  play(target: PlayTarget): void;
  /** Replaces the current item without a new history entry (next episode, version switch). */
  replacePlayback(target: PlayTarget): void;
  stopPlayback(): void;
}

const VIEWS: readonly View[] = ['home', 'movies', 'series', 'live', 'mylist', 'downloads', 'search'];

/**
 * The page's address (issue #221): `#/movies?category=12&details=movies:abc`. The player is left out, so a reload
 * during playback comes back to the page and details behind it. See DECISIONS.md#d-025.
 */
export function uiHash({ view, categoryId, search, details }: UiSnapshot): string {
  const params = new URLSearchParams();
  if (categoryId && (view === 'movies' || view === 'series')) params.set('category', categoryId);
  if (view === 'search' && search) params.set('q', search);
  if (details) params.set('details', `${details.section}:${details.masterId}`);
  const query = params.toString();
  return `#/${view}${query ? `?${query}` : ''}`;
}

/** The page an address opens; anything it does not name falls back to Home. */
export function parseUiHash(hash: string): UiSnapshot {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  const search = params.get('q') ?? '';
  let view = VIEWS.includes(path as View) ? (path as View) : 'home';
  if (view === 'search' && !search.trim()) view = 'home';
  const [section, ...rest] = (params.get('details') ?? '').split(':');
  const masterId = rest.join(':');
  const details: DetailsTarget | null = (section === 'movies' || section === 'series') && masterId ? { section, masterId } : null;
  const categoryId = view === 'movies' || view === 'series' ? params.get('category') || null : null;
  return { view, categoryId, search: view === 'search' ? search : '', details, playing: null };
}

/**
 * Navigation state mirrored into browser history so Back closes the player/modal, and into the address so a reload
 * keeps the page. See DECISIONS.md#d-025.
 */
export function createUiStore(
  history: History | null = typeof window !== 'undefined' ? window.history : null,
  hash = typeof window !== 'undefined' ? window.location.hash : '',
) {
  const start = parseUiHash(hash);
  const store = createStore<UiState>()((set, get) => {
    const snapshot = (): UiSnapshot => {
      const { view, categoryId, search, details, playing } = get();
      return { view, categoryId, search, details, playing };
    };
    const push = (next: Partial<UiSnapshot>) => {
      set(next);
      history?.pushState({ ui: snapshot() }, '', uiHash(snapshot()));
    };
    const replace = () => history?.replaceState({ ui: snapshot() }, '', uiHash(snapshot()));

    return {
      ...start,
      details: history ? null : start.details,
      libraryRevision: 0,
      bumpLibrary: () => set({ libraryRevision: get().libraryRevision + 1 }),
      navigate: (view) => push({ view, categoryId: null, details: null, playing: null }),
      openCategory: (section, categoryId) => push({ view: section, categoryId, details: null, playing: null }),
      setCategory: (categoryId) => {
        set({ categoryId });
        replace();
      },
      setSearch: (search) => {
        set({ search, view: search.trim() ? 'search' : get().view === 'search' ? 'home' : get().view });
        replace();
      },
      openDetails: (details) => push({ details }),
      replaceDetails: (details) => {
        set({ details });
        replace();
      },
      closeDetails: () => (history && get().details ? history.back() : set({ details: null })),
      play: (playing) => push({ playing }),
      replacePlayback: (playing) => {
        set({ playing });
        replace();
      },
      stopPlayback: () => (history && get().playing ? history.back() : set({ playing: null })),
    };
  });

  if (history) {
    // The page under the details gets its own entry, so closing details opened from the address stays in the app.
    const base = { ...start, details: null };
    history.replaceState({ ui: base }, '', uiHash(base));
    if (start.details) store.getState().openDetails(start.details);
  }
  if (typeof window !== 'undefined' && history) {
    window.addEventListener('popstate', (event) => {
      // An address typed or pasted by hand has no state of its own.
      const ui = (event.state as { ui?: UiSnapshot } | null)?.ui ?? parseUiHash(window.location.hash);
      store.setState({ ...ui });
    });
  }
  return store;
}

export type UiStore = ReturnType<typeof createUiStore>;
