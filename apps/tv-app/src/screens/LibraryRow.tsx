import { useEffect } from 'react';
import { pageKey, type LibrarySection, type MediaCategory } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { useLibrary } from '../hooks';

const ROW_SIZE = 30;

/** One row of deduplicated titles (optionally filtered by category or a search term). Hidden when empty. */
export function LibraryRow({
  section,
  category,
  search,
  title,
}: {
  section: LibrarySection;
  category?: MediaCategory;
  search?: string;
  title: string;
}) {
  const query = { categoryId: category?.id ?? null, search: search || null, limit: ROW_SIZE };
  const page = useLibrary((s) => s.pages[pageKey(section, query)]);

  useEffect(() => {
    void stores.library.getState().loadPage(section, query);
    // query is derived from section + category id + search only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, category?.id, search]);

  const items = page?.data?.items ?? [];
  if (page?.status === 'success' && items.length === 0) return null;

  return (
    <Row
      title={title}
      items={items}
      keyOf={(item) => item.id}
      testID={`row-${section}-${search ? 'search' : (category?.id ?? 'all')}`}
      render={(item) => (
        <PosterCard
          title={item.title}
          posterUrl={item.posterUrl}
          badge={item.bestQuality === '4K' ? '4K' : null}
          subtitle={[item.year, item.variantCount > 1 ? `${item.variantCount} versions` : null].filter(Boolean).join(' · ') || null}
          onPress={() => navStore.getState().push({ name: 'details', section, masterId: item.id })}
        />
      )}
    />
  );
}
