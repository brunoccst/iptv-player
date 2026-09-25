import { useEffect, useRef, type ReactNode } from 'react';
import {
  DEFAULT_LIBRARY_SORT,
  DEFAULT_PAGE_SIZE,
  LIBRARY_SORT_OPTIONS,
  sortChoiceKey,
  type LibrarySection,
  type LibrarySort,
  type LibrarySortChoice,
} from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Spinner } from '../../components/Spinner';
import { useCatalog, useLibrary, useUi } from '../../hooks/stores';
import { usePagedLibrary } from '../../hooks/usePagedLibrary';
import { errorText } from '../../ui/errorText';
import { MasterCard } from '../home/MasterCard';

/** Movies or Series: category chips + paged grid of deduplicated titles. */
export function BrowsePage({ section, banner }: { section: LibrarySection; banner: ReactNode }) {
  const revision = useUi((s) => s.libraryRevision);
  const categories = useCatalog((s) => s.categories[section]?.data ?? []);
  const categoryId = useUi((s) => s.categoryId);
  const setCategoryId = (id: string | null) => uiStore.getState().setCategory(id);
  const sort = useLibrary((s) => s.sortChoices[section]) ?? DEFAULT_LIBRARY_SORT;

  useEffect(() => {
    void stores.catalog.getState().loadCategories(section);
  }, [section]);

  return (
    <div className="page">
      <h1 className="page__title">{section === 'movies' ? 'Movies' : 'Series'}</h1>
      {banner}
      <div className="chips" role="tablist" aria-label="Categories">
        <button
          type="button"
          role="tab"
          aria-selected={categoryId === null}
          className={`chip${categoryId === null ? ' chip--active' : ''}`}
          onClick={() => setCategoryId(null)}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={categoryId === category.id}
            className={`chip${categoryId === category.id ? ' chip--active' : ''}`}
            onClick={() => setCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <PagedGrid
        key={`${section}-${categoryId}-${sortChoiceKey(sort)}-${revision}`}
        section={section}
        categoryId={categoryId}
        sort={sort}
        onSort={(choice) => stores.library.getState().chooseSort(section, choice)}
      />
    </div>
  );
}

/**
 * Grid of titles; the next page loads automatically (spinner) when the end scrolls into view.
 * With `onSort`, a "Sort by" menu offers the orders the library has data for.
 */
export function PagedGrid({
  section,
  categoryId = null,
  search = null,
  sort = null,
  onSort,
}: {
  section: LibrarySection;
  categoryId?: string | null;
  search?: string | null;
  sort?: LibrarySortChoice | null;
  onSort?(choice: LibrarySortChoice): void;
}) {
  const page = usePagedLibrary(section, { categoryId, search, sort }, DEFAULT_PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef(page.loadMore);
  loadMore.current = page.loadMore;
  const autoLoad = typeof IntersectionObserver !== 'undefined';

  useEffect(() => {
    if (!autoLoad || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && loadMore.current(), {
      rootMargin: '600px 0px',
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [autoLoad, page.items.length]);

  const toolbar = onSort && sort ? <SortSelect value={sort} sorts={page.sorts ?? [sort.sort]} onChange={onSort} /> : null;
  if (page.error && page.items.length === 0)
    return (
      <>
        {toolbar}
        <p className="error-text" role="alert">
          {errorText(page.error)}
        </p>
      </>
    );
  if (page.items.length === 0)
    return (
      <>
        {toolbar}
        {page.done ? <p className="muted">No titles found.</p> : <Spinner />}
      </>
    );

  return (
    <>
      {toolbar}
      <div className="grid">
        {page.items.map((item) => (
          <MasterCard key={item.id} section={section} item={item} />
        ))}
      </div>
      {page.loadingMore ? (
        <div className="grid__more">
          <Spinner label="Loading more" />
        </div>
      ) : page.hasMore ? (
        <div className="grid__more" ref={sentinel}>
          {autoLoad ? null : (
            <button type="button" className="button button--secondary" onClick={page.loadMore}>
              Load more
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

/** "Sort by" menu: only orders listed in `sorts` (the library's available data). */
function SortSelect({
  value,
  sorts,
  onChange,
}: {
  value: LibrarySortChoice;
  sorts: LibrarySort[];
  onChange(choice: LibrarySortChoice): void;
}) {
  const options = LIBRARY_SORT_OPTIONS.filter((option) => sorts.includes(option.sort));
  return (
    <div className="grid__toolbar">
      <label htmlFor="library-sort">Sort by</label>
      <select
        id="library-sort"
        className="select"
        value={sorts.includes(value.sort) ? sortChoiceKey(value) : 'title-asc'}
        onChange={(event) => {
          const choice = options.find((option) => sortChoiceKey(option) === event.target.value);
          if (choice) onChange({ sort: choice.sort, order: choice.order });
        }}
      >
        {options.map((option) => (
          <option key={sortChoiceKey(option)} value={sortChoiceKey(option)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
