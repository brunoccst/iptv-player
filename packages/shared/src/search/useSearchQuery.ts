import { useEffect, useRef, useState } from 'react';
import type { LibrarySortChoice } from '../stores/libraryStore';
import { t } from '../i18n/i18n';
import { SEARCH_MIN_LENGTH, searchDelay } from './searchDelay';

/** Which results show (D-108): everything, or only movies, series or live channels. */
export type SearchKind = 'all' | 'movies' | 'series' | 'live';
export const SEARCH_KINDS: { kind: SearchKind; label: () => string }[] = [
  { kind: 'all', label: () => t('All') },
  { kind: 'movies', label: () => t('Movies') },
  { kind: 'series', label: () => t('Series') },
  { kind: 'live', label: () => t('Live TV') },
];
/** Search results read best alphabetically. */
export const SEARCH_BY_TITLE: LibrarySortChoice = { sort: 'title', order: 'asc' };
/** Live channels shown for a search. */
export const MAX_SEARCH_CHANNELS = 30;

/**
 * The text to search for, from what is typed (both apps, D-124): waits until typing pauses, adapted to how fast the
 * user types (searchDelay.ts); shorter than SEARCH_MIN_LENGTH searches nothing. A new `submits` count (Enter) searches
 * at once. Starts empty: the first letter opens the page, and searching for it alone froze typing on big libraries.
 */
export function useSearchQuery(typed: string, submits = 0): string {
  const [query, setQuery] = useState('');
  const typing = useRef({ last: 0, gaps: [] as number[] });

  useEffect(() => {
    const now = Date.now();
    const state = typing.current;
    if (state.last) state.gaps = [...state.gaps, now - state.last].slice(-8);
    state.last = now;
    const text = typed.trim();
    const timer = setTimeout(() => setQuery(text.length >= SEARCH_MIN_LENGTH ? text : ''), searchDelay(state.gaps));
    return () => clearTimeout(timer);
  }, [typed]);

  const firstSubmit = useRef(submits);
  useEffect(() => {
    if (submits !== firstSubmit.current && typed.trim()) setQuery(typed.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a submit triggers this
  }, [submits]);

  return query;
}
