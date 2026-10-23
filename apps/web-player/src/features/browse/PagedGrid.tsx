import { useEffect, useRef } from 'react';
import { DEFAULT_PAGE_SIZE, type LibrarySection, type LibrarySortChoice, t } from '@iptv/shared';
import { Spinner } from '../../components/Spinner';
import { usePagedLibrary } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { MasterCard } from '../home/MasterCard';

/**
 * Grid of titles; the next page loads automatically (spinner) when the end scrolls into view.
 */
export function PagedGrid({
  section,
  categoryId = null,
  search = null,
  sort = null,
}: {
  section: LibrarySection;
  categoryId?: string | null;
  search?: string | null;
  sort?: LibrarySortChoice | null;
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

  if (page.error && page.items.length === 0)
    return (
      <p className="error-text" role="alert">
        {errorText(page.error)}
      </p>
    );
  if (page.items.length === 0) return page.done ? <p className="muted">{t('No titles found.')}</p> : <Spinner />;

  return (
    <>
      <div className="grid">
        {page.items.map((item) => (
          <MasterCard key={item.id} section={section} item={item} />
        ))}
      </div>
      {page.loadingMore ? (
        <div className="grid__more">
          <Spinner label={t('Loading more')} />
        </div>
      ) : page.hasMore ? (
        <div className="grid__more" ref={sentinel}>
          {autoLoad ? null : (
            <button type="button" className="button button--secondary" onClick={page.loadMore}>
              {t('Load more')}
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}
