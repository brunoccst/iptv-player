import type { LibrarySection, MediaCategory } from '@iptv/shared';
import { navStore } from '../appContext';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { usePagedLibrary } from './usePagedLibrary';

const ROW_SIZE = 30;

/**
 * One row of deduplicated titles (optionally filtered by category or a search term). Hidden when empty.
 * More titles load as the row scrolls; the title opens the whole category (not for search rows).
 */
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
  const page = usePagedLibrary(section, { categoryId: category?.id, search }, ROW_SIZE);
  if (page.done && page.items.length === 0) return null;

  return (
    <Row
      title={title}
      items={page.items}
      keyOf={(item) => item.id}
      testID={`row-${section}-${search ? 'search' : (category?.id ?? 'all')}`}
      loading={page.loadingFirst}
      loadingMore={page.loadingMore}
      onEndReached={page.loadMore}
      onTitlePress={
        search ? undefined : () => navStore.getState().push({ name: 'category', section, categoryId: category?.id ?? null, title })
      }
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
