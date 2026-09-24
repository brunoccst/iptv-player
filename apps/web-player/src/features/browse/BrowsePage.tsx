import { useEffect, useRef, type ReactNode } from 'react';
import { DEFAULT_PAGE_SIZE, type LibrarySection } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Spinner } from '../../components/Spinner';
import { useCatalog, useUi } from '../../hooks/stores';
import { usePagedLibrary } from '../../hooks/usePagedLibrary';
import { errorText } from '../../ui/errorText';
import { MasterCard } from '../home/MasterCard';

/** Movies or Series: category chips + paged grid of deduplicated titles. */
export function BrowsePage({ section, banner }: { section: LibrarySection; banner: ReactNode }) {
  const revision = useUi((s) => s.libraryRevision);
  const categories = useCatalog((s) => s.categories[section]?.data ?? []);
  const categoryId = useUi((s) => s.categoryId);
  const setCategoryId = (id: string | null) => uiStore.getState().setCategory(id);

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
      <PagedGrid key={`${section}-${categoryId}-${revision}`} section={section} categoryId={categoryId} />
    </div>
  );
}

/** Grid of titles; the next page loads automatically (spinner) when the end scrolls into view. */
export function PagedGrid({
  section,
  categoryId = null,
  search = null,
}: {
  section: LibrarySection;
  categoryId?: string | null;
  search?: string | null;
}) {
  const page = usePagedLibrary(section, { categoryId, search }, DEFAULT_PAGE_SIZE);
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

  if (page.error && page.items.length === 0)
    return (
      <p className="error-text" role="alert">
        {errorText(page.error)}
      </p>
    );
  if (page.items.length === 0) return page.done ? <p className="muted">No titles found.</p> : <Spinner />;

  return (
    <>
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
