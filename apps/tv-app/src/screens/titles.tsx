import { DEFAULT_LIBRARY_SORT, TOP_RATED_POOL, topRated, type LibrarySection, type MediaCategory, t } from '@iptv/shared';
import { navStore } from '../appContext';
import { Row } from '../components/Row';
import { usePagedLibrary } from '../hooks';
import { TitleCard, useGridColumns } from '@iptv/screens';
import '../screenHost';

/** Home rows show only the first titles; the arrow card at the end opens the category page. */
const ROW_SIZE = 10;

// Shared with the desktop app (issue #237, DECISIONS.md#d-193).
export { TitleCard, useGridColumns };
export { LoadingMoreNote, TitleGrid, TvLines } from '@iptv/screens';

/** Home row: the first 10 titles of a section/category. The title and the arrow card open Movies/Series on that category. */
export function TitleRow({ section, category, title }: { section: LibrarySection; category?: MediaCategory; title: string }) {
  const page = usePagedLibrary(section, { categoryId: category?.id }, ROW_SIZE);
  if (page.done && page.items.length === 0) return null;
  const open = () => navStore.getState().openCategory(section, category?.id ?? null);
  return (
    <Row
      title={title}
      items={page.items}
      keyOf={(item) => item.id}
      testID={`row-${section}-${category?.id ?? 'all'}`}
      loading={page.loadingFirst}
      empty={page.error ? t('Could not load this row.') : ' '}
      onTitlePress={open}
      more={page.hasMore ? { onPress: open } : undefined}
      render={(item) => <TitleCard section={section} item={item} />}
    />
  );
}

/** "Top rated": the 25 best rated of the titles added last; the app's own row, so no "See all" (D-040, issue #188). */
export function TopRatedRow({ section, title }: { section: LibrarySection; title: string }) {
  const page = usePagedLibrary(section, { sort: DEFAULT_LIBRARY_SORT }, TOP_RATED_POOL);
  const items = topRated(page.items);
  // Only the first page is read: the row hides once it is in and has no rated title.
  if (!page.loadingFirst && !page.error && items.length === 0) return null;
  return (
    <Row
      title={title}
      items={items}
      keyOf={(item) => item.id}
      testID={`row-${section}-top-rated`}
      loading={page.loadingFirst}
      empty={page.error ? t('Could not load this row.') : ' '}
      render={(item) => <TitleCard section={section} item={item} />}
    />
  );
}
