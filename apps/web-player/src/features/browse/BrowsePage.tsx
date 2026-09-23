import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_PAGE_SIZE, pageKey, type LibrarySection, type MasterCard as MasterCardData } from '@iptv/shared';
import { stores } from '../../appContext';
import { Spinner } from '../../components/Spinner';
import { useCatalog, useLibrary, useUi } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { MasterCard } from '../home/MasterCard';

/** Movies or Series: category chips + paged grid of deduplicated titles. */
export function BrowsePage({ section, banner }: { section: LibrarySection; banner: ReactNode }) {
  const revision = useUi((s) => s.libraryRevision);
  const categories = useCatalog((s) => s.categories[section]?.data ?? []);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    void stores.catalog.getState().loadCategories(section);
    setCategoryId(null);
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

/** Loads pages of DEFAULT_PAGE_SIZE and appends them ("Load more"). */
export function PagedGrid({
  section,
  categoryId = null,
  search = null,
}: {
  section: LibrarySection;
  categoryId?: string | null;
  search?: string | null;
}) {
  const [pages, setPages] = useState(1);
  const resources = useLibrary((s) =>
    Array.from({ length: pages }, (_, i) => s.pages[pageKey(section, { categoryId, search, offset: i * DEFAULT_PAGE_SIZE })]),
  );

  useEffect(() => {
    void stores.library.getState().loadPage(section, { categoryId, search, offset: (pages - 1) * DEFAULT_PAGE_SIZE });
  }, [section, categoryId, search, pages]);

  const items: MasterCardData[] = resources.flatMap((r) => r?.data?.items ?? []);
  const total = resources[0]?.data?.total ?? 0;
  const last = resources[resources.length - 1];

  if (last?.status === 'error')
    return (
      <p className="error-text" role="alert">
        {errorText(last.error)}
      </p>
    );
  if (items.length === 0) return last?.status === 'success' ? <p className="muted">No titles found.</p> : <Spinner />;

  return (
    <>
      <div className="grid">
        {items.map((item) => (
          <MasterCard key={item.id} section={section} item={item} />
        ))}
      </div>
      {items.length < total ? (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            type="button"
            className="button button--secondary"
            disabled={last?.status === 'loading'}
            onClick={() => setPages(pages + 1)}
          >
            Load more
          </button>
        </div>
      ) : null}
    </>
  );
}
