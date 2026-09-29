import { memo, startTransition, useCallback, useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TVFocusGuideView,
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
  t,
} from '@iptv/shared';
import { navStore } from '../appContext';
import { CardMenu } from '../components/CardMenu';
import { useTitleCard } from '../hooks';
import { ErrorText, errorText } from '../components/Feedback';
import { CenterFocus, CenteringScrollView, useCenterPage } from '../components/CenterScroll';
import { FocusRow, RowFocus } from '../components/FocusRow';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { Select } from '../components/Select';
import { colors, useSizes } from '../theme';
import { usePagedLibrary } from '../hooks';

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
  const [menu, setMenu] = useState(false);
  const openDetails = () => navStore.getState().push({ name: 'details', section, masterId: item.id });
  const card = useTitleCard(section, item, openDetails);
  return (
    <>
      <PosterCard
        title={item.title}
        posterUrl={item.posterUrl}
        width={width}
        hasTVPreferredFocus={hasTVPreferredFocus}
        reserveSubtitle
        badge={card.badge}
        watched={card.watched}
        subtitle={card.subtitle}
        onPress={openDetails}
        onLongPress={() => setMenu(true)}
      />
      {menu ? (
        <CardMenu
          title={item.title}
          onClose={() => setMenu(false)}
          actions={card.menuItems().map((entry) => ({ label: entry.label, testID: `card-menu-${entry.id}`, onPress: entry.run }))}
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

  const listHeader =
    onSort && sort ? (
      <>
        {header}
        <SortBar value={sort} sorts={page.sorts ?? [sort.sort]} onChange={onSort} />
      </>
    ) : (
      header
    );
  const renderLine = (line: MasterCard[], lineIndex: number) => (
    <FocusRow key={line[0]!.id} style={[styles.line, { paddingHorizontal: gutter }]}>
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
  );
  const footer = page.loadingMore ? (
    <ActivityIndicator style={styles.more} size="large" color={colors.accent} accessibilityLabel={t('Loading more')} />
  ) : (
    <View style={styles.bottom} />
  );

  // TV: a plain ScrollView, like Home. A FlatList on Android TV got a 2 px viewport on the Movies/Series pages: nothing
  // under the header showed and every frame took seconds, which froze the app (D-093). Pages load as it scrolls; only
  // the lines near the focus are mounted, and the focused title is kept in the middle of the screen (D-094).
  if (Platform.isTV) {
    return (
      <TvGrid
        testID={testID ?? `grid-${section}`}
        header={listHeader}
        lines={lines}
        empty={empty}
        renderLine={renderLine}
        loadingMore={page.loadingMore}
        onScroll={onScroll}
        onNearEnd={page.loadMore}
      />
    );
  }

  return (
    <FlatList
      key={columns}
      testID={testID ?? `grid-${section}`}
      style={styles.list}
      data={lines}
      keyExtractor={(line) => line[0]!.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={empty}
      renderItem={({ item: line, index: lineIndex }) => renderLine(line, lineIndex)}
      onEndReached={page.loadMore}
      onEndReachedThreshold={1.5}
      onScroll={onScroll}
      scrollEventThrottle={100}
      ListFooterComponent={footer}
      removeClippedSubviews={false}
      initialNumToRender={3}
      maxToRenderPerBatch={2}
      windowSize={5}
    />
  );
}

/** Lines kept mounted above and below the focused one on TV; the rest are empty spacers of the same height. */
const MOUNTED_AROUND = 8;
/** The mounted lines move only when the focus gets this close to their edge, a few lines at a time (D-099). */
const WINDOW_EDGE = 3;

/**
 * TV grid (D-093, D-094): a scroll view that asks for the next page when its end is within one and a half screens.
 * Only the lines near the focused one are mounted: with every loaded page mounted, a Chromecast slowed down for good
 * after the first extra page. A note at the bottom of the screen shows while a page loads, and the focused title is
 * kept in the middle of the screen.
 */
function TvGrid({
  testID,
  header,
  lines,
  empty,
  renderLine,
  loadingMore,
  onScroll,
  onNearEnd,
}: {
  testID: string;
  header: ReactNode;
  lines: MasterCard[][];
  empty: ReactNode;
  renderLine(line: MasterCard[], index: number): ReactElement;
  loadingMore: boolean;
  onScroll?(event: NativeSyntheticEvent<NativeScrollEvent>): void;
  onNearEnd(): void;
}) {
  const viewport = useRef(0);
  const offset = useRef(0);
  const content = useRef(0);
  const check = () => {
    if (viewport.current > 0 && content.current > 0 && content.current - offset.current - viewport.current < viewport.current * 1.5)
      onNearEnd();
  };
  return (
    <View style={styles.list}>
      <CenteringScrollView
        testID={testID}
        style={styles.list}
        onlyCentering
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
          check();
        }}
        onContentSizeChange={(_width, height) => {
          content.current = height;
          check();
        }}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
          check();
          onScroll?.(event);
        }}
      >
        {header}
        {lines.length === 0 ? empty : <TvLines lines={lines} renderLine={renderLine} onNearEnd={onNearEnd} />}
        <View style={styles.bottom} />
      </CenteringScrollView>
      {loadingMore ? <LoadingMoreNote /> : null}
    </View>
  );
}

/** "Loading more titles…" at the bottom of the screen, over the page (TV). */
export function LoadingMoreNote() {
  return (
    <View style={styles.loadingNote} pointerEvents="none" accessibilityRole="alert" testID="grid-loading-more">
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={styles.loadingText}>{t('Loading more titles…')}</Text>
    </View>
  );
}

/**
 * TV lines of cards (D-094, D-095, D-096, D-098, D-099): only the lines within MOUNTED_AROUND of the focus are
 * mounted, the others are empty spacers; when the focus reaches one of the last two lines, `onNearEnd` asks for the
 * next page. Used by the Movies/Series grid and the search results.
 *
 * Every line, mounted or spacer, has the height of the first one, so swapping lines for spacers never moves the page.
 * The focused line is centred exactly like the rows on Home: its place in the page comes from layout (where the block
 * sits, plus index × line height), and the page scrolls there on the same key press, with nothing measured.
 * `parentY` is where the block's parent sits in the page, when the block is not directly in the scroll view (search).
 *
 * Moving between lines must stay light (D-099): lines are memoised, so a move re-renders nothing; the mounted lines
 * move only when the focus nears their edge, as a low-priority update that never holds up the key press; and Up is
 * kept inside the block while the focus is below its first line. Held Up went faster than lines were mounted, so the
 * focus jumped over the empty spacers to the category bar and the page showed only spacers.
 */
export function TvLines({
  lines,
  renderLine,
  onNearEnd,
  testPrefix = 'grid',
  parentY,
}: {
  lines: MasterCard[][];
  renderLine(line: MasterCard[], index: number): ReactElement;
  onNearEnd?(): void;
  testPrefix?: string;
  parentY?: RefObject<number>;
}) {
  const [windowCenter, setWindowCenter] = useState(0);
  const [lineHeight, setLineHeight] = useState(0);
  const [onFirstLine, setOnFirstLine] = useState(true);
  const page = useCenterPage();
  const blockY = useRef(0);
  // The latest values for the focus handler, which stays the same function so the lines never re-render for it.
  const latest = useRef({ page, lineHeight, windowCenter, count: lines.length, onNearEnd, parentY });
  latest.current = { page, lineHeight, windowCenter, count: lines.length, onNearEnd, parentY };
  const focusLine = useCallback((index: number) => {
    const now = latest.current;
    if (now.page && now.lineHeight)
      now.page.centerAt((now.parentY?.current ?? 0) + blockY.current + index * now.lineHeight, now.lineHeight);
    setOnFirstLine(index === 0);
    if (Math.abs(index - now.windowCenter) > MOUNTED_AROUND - WINDOW_EDGE) startTransition(() => setWindowCenter(index));
    if (index >= now.count - 2) now.onNearEnd?.();
  }, []);
  const measureFirst = useCallback((height: number) => setLineHeight((known) => known || height), []);
  return (
    <TVFocusGuideView
      testID={`${testPrefix}-lines`}
      trapFocusUp={Platform.isTV && !onFirstLine}
      onLayout={(event) => (blockY.current = event.nativeEvent.layout.y)}
    >
      {/* The line centres itself: cards must not measure and scroll too. */}
      <CenterFocus.Provider value={null}>
        {lines.map((line, index) => (
          <TvLine
            key={line[0]!.id}
            line={line}
            index={index}
            // The first line stays mounted: its first card asks for the focus when it mounts (hasTVPreferredFocus).
            mounted={index === 0 || Math.abs(index - windowCenter) <= MOUNTED_AROUND || !lineHeight}
            lineHeight={lineHeight}
            testPrefix={testPrefix}
            renderLine={renderLine}
            onFocusLine={focusLine}
            onFirstHeight={index === 0 ? measureFirst : undefined}
          />
        ))}
      </CenterFocus.Provider>
    </TVFocusGuideView>
  );
}

/** One line of `TvLines`, or its spacer; re-renders only when its own props change. */
const TvLine = memo(function TvLine({
  line,
  index,
  mounted,
  lineHeight,
  testPrefix,
  renderLine,
  onFocusLine,
  onFirstHeight,
}: {
  line: MasterCard[];
  index: number;
  mounted: boolean;
  lineHeight: number;
  testPrefix: string;
  renderLine(line: MasterCard[], index: number): ReactElement;
  onFocusLine(index: number): void;
  onFirstHeight?(height: number): void;
}) {
  const focus = useCallback(() => onFocusLine(index), [onFocusLine, index]);
  if (!mounted) return <View testID={`${testPrefix}-spacer-${index}`} style={{ height: lineHeight }} />;
  return (
    <View
      testID={`${testPrefix}-line-${index}`}
      style={lineHeight ? { height: lineHeight } : undefined}
      onLayout={onFirstHeight && !lineHeight ? (event) => onFirstHeight(event.nativeEvent.layout.height) : undefined}
    >
      <RowFocus.Provider value={focus}>{renderLine(line, index)}</RowFocus.Provider>
    </View>
  );
});

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
  loadingNote: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 12,
  },
  loadingText: { color: colors.text, fontSize: 16 },
});
