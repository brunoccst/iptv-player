import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { LibrarySection, MasterCard, MediaCategory } from '@iptv/shared';
import { navStore } from '../appContext';
import { ErrorText, errorText } from '../components/Feedback';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { colors, useSizes } from '../theme';
import { usePagedLibrary } from './usePagedLibrary';

/** Home rows show only the first titles; the arrow card at the end opens the category page. */
const ROW_SIZE = 10;
const GRID_PAGE = 100;
const GRID_GAP = 8;

/** Web `MasterCard`: poster, 4K badge, "year · N versions"; opens the details panel. */
export function MasterCardItem({
  section,
  item,
  width,
  hasTVPreferredFocus,
}: {
  section: LibrarySection;
  item: MasterCard;
  width?: number;
  hasTVPreferredFocus?: boolean;
}) {
  return (
    <PosterCard
      title={item.title}
      posterUrl={item.posterUrl}
      width={width}
      hasTVPreferredFocus={hasTVPreferredFocus}
      badge={item.bestQuality === '4K' ? '4K' : null}
      subtitle={[item.year, item.variantCount > 1 ? `${item.variantCount} versions` : null].filter(Boolean).join(' · ') || null}
      onPress={() => navStore.getState().push({ name: 'details', section, masterId: item.id })}
    />
  );
}

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
      empty={page.error ? 'Could not load this row.' : ' '}
      onTitlePress={open}
      more={page.hasMore ? { onPress: open } : undefined}
      render={(item) => <MasterCardItem section={section} item={item} />}
    />
  );
}

/** Columns and card width of the web `.grid` (auto-fill, minmax(card width, 1fr), 8 px gap) for this screen. */
export function useGridColumns() {
  const { width } = useWindowDimensions();
  const { gutter, cardWidth } = useSizes();
  const available = width - gutter * 2;
  const columns = Math.max(1, Math.floor((available + GRID_GAP) / (cardWidth + GRID_GAP)));
  return { columns, itemWidth: Math.floor((available - GRID_GAP * (columns - 1)) / columns) };
}

/**
 * Web `PagedGrid`: titles for a section (category or search), 100 per page; the next page loads near the end with a spinner.
 * `header` renders above the grid (page title, chips); `embedded` renders all loaded items without its own scroll (search page).
 */
export function TitleGrid({
  section,
  categoryId = null,
  search = null,
  header,
  testID,
  onScroll,
}: {
  section: LibrarySection;
  categoryId?: string | null;
  search?: string | null;
  header?: ReactElement;
  testID?: string;
  onScroll?(event: NativeSyntheticEvent<NativeScrollEvent>): void;
}) {
  const page = usePagedLibrary(section, { categoryId, search }, GRID_PAGE);
  const { columns, itemWidth } = useGridColumns();
  const { gutter } = useSizes();

  const empty = page.loadingFirst ? (
    <ActivityIndicator size="large" color={colors.accent} style={styles.first} accessibilityLabel="Loading" />
  ) : page.error ? (
    <View style={{ marginHorizontal: gutter }}>
      <ErrorText>{errorText(page.error)}</ErrorText>
    </View>
  ) : (
    <Text style={[styles.muted, { marginHorizontal: gutter }]}>No titles found.</Text>
  );

  return (
    <FlatList
      key={columns}
      testID={testID ?? `grid-${section}`}
      style={styles.list}
      data={page.items}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={columns > 1 ? [styles.line, { paddingHorizontal: gutter }] : undefined}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item, index }) => (
        <View style={columns === 1 ? { paddingHorizontal: gutter, marginBottom: 24 } : undefined}>
          <MasterCardItem section={section} item={item} width={itemWidth} hasTVPreferredFocus={Platform.isTV && index === 0} />
        </View>
      )}
      onEndReached={page.loadMore}
      onEndReachedThreshold={1.5}
      onScroll={onScroll}
      scrollEventThrottle={100}
      ListFooterComponent={
        page.loadingMore ? (
          <ActivityIndicator style={styles.more} size="large" color={colors.accent} accessibilityLabel="Loading more" />
        ) : (
          <View style={styles.bottom} />
        )
      }
      removeClippedSubviews={false}
      initialNumToRender={columns * 3}
      maxToRenderPerBatch={columns * 2}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  line: { gap: GRID_GAP, marginBottom: 24 },
  muted: { color: colors.muted, fontSize: 16 },
  first: { marginVertical: 40 },
  more: { marginVertical: 24 },
  bottom: { height: 60 },
});
