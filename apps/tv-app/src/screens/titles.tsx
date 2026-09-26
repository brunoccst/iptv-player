import { useMemo, type ReactElement } from 'react';
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
import {
  LIBRARY_SORT_OPTIONS,
  sortChoiceKey,
  type LibrarySection,
  type LibrarySort,
  type LibrarySortChoice,
  type MasterCard,
  type MediaCategory,
} from '@iptv/shared';
import { navStore } from '../appContext';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusRow } from '../components/FocusRow';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { Select } from '../components/Select';
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
 * `header` renders above the grid (page title, chips); with `onSort` a "Sort by" select follows it.
 */
export function TitleGrid({
  section,
  categoryId = null,
  search = null,
  sort = null,
  onSort,
  header,
  testID,
  onScroll,
  emptyText,
}: {
  section: LibrarySection;
  categoryId?: string | null;
  search?: string | null;
  sort?: LibrarySortChoice | null;
  onSort?(choice: LibrarySortChoice): void;
  header?: ReactElement;
  testID?: string;
  onScroll?(event: NativeSyntheticEvent<NativeScrollEvent>): void;
  /** Text when there are no titles (default "No titles found."). */
  emptyText?: string;
}) {
  const page = usePagedLibrary(section, { categoryId, search, sort }, GRID_PAGE);
  const { columns, itemWidth } = useGridColumns();
  const { gutter } = useSizes();
  // Rendered line by line: each line is a focus row, so Left/Right at its ends stop instead of moving up or down.
  const items = page.items;
  const lines = useMemo(() => {
    const result: (typeof items)[] = [];
    for (let start = 0; start < items.length; start += columns) result.push(items.slice(start, start + columns));
    return result;
  }, [items, columns]);

  const empty = page.loadingFirst ? (
    <ActivityIndicator size="large" color={colors.accent} style={styles.first} accessibilityLabel="Loading" />
  ) : page.error ? (
    <View style={{ marginHorizontal: gutter }}>
      <ErrorText>{errorText(page.error)}</ErrorText>
    </View>
  ) : (
    <Text style={[styles.muted, { marginHorizontal: gutter }]}>{emptyText ?? 'No titles found.'}</Text>
  );

  return (
    <FlatList
      key={columns}
      testID={testID ?? `grid-${section}`}
      style={styles.list}
      data={lines}
      keyExtractor={(line) => line[0]!.id}
      ListHeaderComponent={
        onSort && sort ? (
          <>
            {header}
            <SortBar value={sort} sorts={page.sorts ?? [sort.sort]} onChange={onSort} />
          </>
        ) : (
          header
        )
      }
      ListEmptyComponent={empty}
      renderItem={({ item: line, index: lineIndex }) => (
        <FocusRow style={[styles.line, { paddingHorizontal: gutter }]}>
          {line.map((item, index) => (
            <MasterCardItem
              key={item.id}
              section={section}
              item={item}
              width={itemWidth}
              hasTVPreferredFocus={Platform.isTV && lineIndex === 0 && index === 0}
            />
          ))}
        </FocusRow>
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
      initialNumToRender={3}
      maxToRenderPerBatch={2}
      windowSize={5}
    />
  );
}

/** Web "Sort by" menu: only the orders the library has data for. */
function SortBar({
  value,
  sorts,
  onChange,
}: {
  value: LibrarySortChoice;
  sorts: LibrarySort[];
  onChange(choice: LibrarySortChoice): void;
}) {
  const { gutter } = useSizes();
  const options = LIBRARY_SORT_OPTIONS.filter((option) => sorts.includes(option.sort));
  return (
    <View style={[styles.sortBar, { paddingHorizontal: gutter }]}>
      <Text style={[styles.muted, styles.noShrink]}>Sort by</Text>
      <Select
        compact
        label="Sort by"
        testID="sort"
        value={sorts.includes(value.sort) ? sortChoiceKey(value) : 'title-asc'}
        options={options.map((option) => ({ value: sortChoiceKey(option), label: option.label }))}
        onChange={(key) => {
          const choice = options.find((option) => sortChoiceKey(option) === key);
          if (choice) onChange({ sort: choice.sort, order: choice.order });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sortBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: -8, marginBottom: 16 },
  list: { flex: 1, backgroundColor: colors.bg },
  line: { flexDirection: 'row', gap: GRID_GAP, marginBottom: 24 },
  muted: { color: colors.muted, fontSize: 16 },
  noShrink: { flexShrink: 0 },
  first: { marginVertical: 40 },
  more: { marginVertical: 24 },
  bottom: { height: 60 },
});
