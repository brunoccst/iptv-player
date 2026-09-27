import { useMemo, useState, type ReactElement } from 'react';
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
  cardMenuItems,
  isMovieWatched,
  isSeriesWatched,
  setSeriesWatched,
  setMovieWatched,
  LIBRARY_SORT_OPTIONS,
  sortChoiceKey,
  type LibrarySection,
  type LibrarySort,
  type LibrarySortChoice,
  type MasterCard,
  type MediaCategory,
  t,
  tn,
} from '@iptv/shared';
import { api, navStore, stores } from '../appContext';
import { CardMenu } from '../components/CardMenu';
import { useProfilePrefs, useProgress } from '../hooks';
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

/**
 * Web `MasterCard`: poster, 4K badge, "year · N versions", "Watched" tag on finished movies and fully watched series (D-082); opens the details panel.
 * Holding OK (a long touch on phones) opens its menu: Go to details, Mark as (not) watched (D-081).
 */
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
  const movieWatched = useProgress((s) => section === 'movies' && isMovieWatched(s.items.data ?? [], item.id));
  const profileId = useProgress((s) => s.profileId);
  const seriesWatched = useProfilePrefs((s) => section === 'series' && isSeriesWatched(s.prefs, profileId, item.id));
  const watched = movieWatched || seriesWatched;
  const [menu, setMenu] = useState(false);
  const openDetails = () => navStore.getState().push({ name: 'details', section, masterId: item.id });
  return (
    <>
      <PosterCard
        title={item.title}
        posterUrl={item.posterUrl}
        width={width}
        hasTVPreferredFocus={hasTVPreferredFocus}
        badge={item.bestQuality === '4K' ? '4K' : null}
        watched={watched}
        subtitle={
          [item.year, item.variantCount > 1 ? tn('{count} version', '{count} versions', item.variantCount) : null]
            .filter(Boolean)
            .join(' · ') || null
        }
        onPress={openDetails}
        onLongPress={() => setMenu(true)}
      />
      {menu ? (
        <CardMenu
          title={item.title}
          onClose={() => setMenu(false)}
          actions={cardMenuItems({ kind: section === 'movies' ? 'movie' : 'series', watched }).map((entry) => ({
            label: entry.label,
            testID: `card-menu-${entry.id}`,
            onPress: () => {
              if (entry.id === 'details') openDetails();
              else if (section === 'movies') void setMovieWatched(stores, item.id, entry.id === 'watched');
              else void setSeriesWatched({ api, ...stores }, item.id, entry.id === 'watched');
            },
          }))}
        />
      ) : null}
    </>
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
      empty={page.error ? t('Could not load this row.') : ' '}
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
    <ActivityIndicator size="large" color={colors.accent} style={styles.first} accessibilityLabel={t('Loading')} />
  ) : page.error ? (
    <View style={{ marginHorizontal: gutter }}>
      <ErrorText>{errorText(page.error)}</ErrorText>
    </View>
  ) : (
    <Text style={[styles.muted, { marginHorizontal: gutter }]}>{emptyText ?? t('No titles found.')}</Text>
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
          <ActivityIndicator style={styles.more} size="large" color={colors.accent} accessibilityLabel={t('Loading more')} />
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
      <Text style={[styles.muted, styles.noShrink]}>{t('Sort by')}</Text>
      <Select
        compact
        label={t('Sort by')}
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
