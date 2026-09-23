import { useEffect, useState } from 'react';
import { useUi } from '../../hooks/stores';
import { PagedGrid } from './BrowsePage';

const DEBOUNCE_MS = 300;

/** Searches movies and series (title or normalized key). */
export function SearchPage() {
  const search = useUi((s) => s.search);
  const [query, setQuery] = useState(search.trim());

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="page">
      <h1 className="page__title">Results for “{query}”</h1>
      {query ? (
        <>
          <h2 className="row__title" style={{ margin: '0 0 12px' }}>Movies</h2>
          <PagedGrid key={`m-${query}`} section="movies" search={query} />
          <h2 className="row__title" style={{ margin: '32px 0 12px' }}>Series</h2>
          <PagedGrid key={`s-${query}`} section="series" search={query} />
        </>
      ) : null}
    </div>
  );
}
