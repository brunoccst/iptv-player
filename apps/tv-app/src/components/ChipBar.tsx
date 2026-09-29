import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors } from '../theme';
import { Icon } from './Icon';
import { focus } from './focus';
import { FocusRow } from './FocusRow';
import { useCenterOnFocus } from './CenterScroll';
import { t } from '@iptv/shared';

export interface ChipItem {
  key: string;
  label: string;
  active: boolean;
  onPress(): void;
  testID?: string;
}

/** Chips rendered at first on the line and in the expanded box; more follow as the user scrolls toward the end. */
const LINE_PAGE = 40;
const BOX_PAGE = 150;
/** TV: at most this many categories between "All" and the ‹ › buttons; fewer when their names do not fit (D-105). */
const TV_WINDOW = 3;
/** Space between the items of the bar (styles.bar gap). */
const GAP = 8;
/** Distance from the end (dp) at which the next page is added. */
const NEAR_END = 400;

/** True when a scroll view is within NEAR_END of its end (horizontally or vertically). */
function nearEnd({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>, horizontal: boolean): boolean {
  const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
  return horizontal
    ? contentOffset.x + layoutMeasurement.width >= contentSize.width - NEAR_END
    : contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END;
}

/**
 * Category chips on one scrollable line. When they do not fit, "Show all" wraps every chip across the full width in
 * a box of at most half the screen that scrolls on its own, so "Show less" stays in view above it (D-091);
 * "Show less" returns to the line; picking a chip also returns to it, scrolled so the chosen chip is in view.
 *
 * Chips are rendered a page at a time (D-093): providers with 100k+ titles have thousands of categories, and building
 * a focusable chip for each at once froze a Chromecast when Movies or Series opened.
 */
export function ChipBar({ chips, label, testID }: { chips: ChipItem[]; label: string; testID?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [lineWidth, setLineWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [lineLimit, setLineLimit] = useState(LINE_PAGE);
  const [boxLimit, setBoxLimit] = useState(BOX_PAGE);
  const [boxContentHeight, setBoxContentHeight] = useState(0);
  // TV: the first chip of the categories shown after "All" (null: around the chosen one).
  const [tvStart, setTvStart] = useState<number | null>(null);
  // TV: where the focus goes after "Show all" / "Show less" (D-105): the chosen chip in the box, or back on the button.
  // The button itself is replaced when the bar changes shape; without this the focus fell to the grid or "Sort by".
  const [focusAfter, setFocusAfter] = useState<'active' | 'toggle' | null>(null);
  // TV: measured widths (the bar, "All", ‹ ›, "Show all", each category chip), to show only the chips that fit.
  const [tvWidths, setTvWidths] = useState<Record<string, number>>({});
  const setTvWidth = (key: string, width: number) =>
    setTvWidths((known) => (Math.abs((known[key] ?? -1) - width) < 1 ? known : { ...known, [key]: width }));
  const tvRoomWithout = () => (tvWidths.bar ?? 0) - (tvWidths.all ?? 0) - GAP;
  const tvRoomWith = () => tvRoomWithout() - (tvWidths.prev ?? 0) - (tvWidths.next ?? 0) - (tvWidths.toggle ?? 0) - 3 * GAP;
  /**
   * How many chips from `from` (going forward, or backward with step -1) fit in `room`, between 1 and TV_WINDOW.
   * Until the bar and the chips are measured, TV_WINDOW.
   */
  const fitCount = (list: ChipItem[], from: number, room: number, step: 1 | -1) => {
    if (!tvWidths.bar) return TV_WINDOW;
    let used = 0;
    let count = 0;
    for (let index = from; index >= 0 && index < list.length && count < TV_WINDOW; index += step) {
      const width = tvWidths[`chip:${list[index]!.key}`];
      if (width === undefined) return count > 0 ? count : TV_WINDOW;
      if (count > 0 && used + GAP + width > room) break;
      used += (count > 0 ? GAP : 0) + width;
      count += 1;
    }
    return Math.max(1, count);
  };
  /** Whether all of `list[from…to)` fits in `room` (unknown widths: assume it does). */
  const fitsWhole = (list: ChipItem[], from: number, to: number, room: number) => {
    if (!tvWidths.bar) return true;
    let used = 0;
    for (let index = from; index < to; index += 1) {
      const width = tvWidths[`chip:${list[index]!.key}`];
      if (width === undefined) return true;
      used += (index > from ? GAP : 0) + width;
    }
    return used <= room;
  };
  const { height } = useWindowDimensions();
  const boxHeight = Math.round(height * 0.5);
  // On the line, a chosen chip beyond the first page moves right after the first one ("All"), so it shows without
  // rendering every chip before it.
  const activeIndex = chips.findIndex((chip) => chip.active);
  const lineChips =
    activeIndex >= LINE_PAGE ? [chips[0]!, chips[activeIndex]!, ...chips.slice(1, activeIndex), ...chips.slice(activeIndex + 1)] : chips;
  // The expanded box does the same beyond its first page, so the focus can go to the chosen chip (D-105).
  const boxChips =
    activeIndex >= BOX_PAGE ? [chips[0]!, chips[activeIndex]!, ...chips.slice(1, activeIndex), ...chips.slice(activeIndex + 1)] : chips;
  const lineCount = Math.min(chips.length, lineLimit);
  const boxCount = Math.min(chips.length, boxLimit);
  const scroll = useRef<ScrollView>(null);
  // Scroll the active chip into view once it is laid out: on open (e.g. from a Home row) and after collapsing.
  const reveal = useRef(true);
  const overflows = contentWidth > lineWidth + 1;

  // Render more while the rendered chips do not fill the line or the box, so "Show all" and scrolling still appear.
  useEffect(() => {
    if (!expanded && lineWidth > 0 && contentWidth > 0 && !overflows && lineCount < chips.length) setLineLimit(lineCount + LINE_PAGE);
  }, [expanded, lineWidth, contentWidth, overflows, lineCount, chips.length]);
  useEffect(() => {
    if (expanded && boxContentHeight > 0 && boxContentHeight < boxHeight && boxCount < chips.length) setBoxLimit(boxCount + BOX_PAGE);
  }, [expanded, boxContentHeight, boxHeight, boxCount, chips.length]);

  const choose = (chip: ChipItem) => {
    reveal.current = true;
    setTvStart(null);
    setFocusAfter(null);
    setExpanded(false);
    chip.onPress();
  };
  // Chips can report several layouts while the line settles; scroll once, shortly after the last one.
  const activeX = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (revealTimer.current && clearTimeout(revealTimer.current)), []);
  const scheduleReveal = () => {
    if (!reveal.current || activeX.current === null) return;
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      reveal.current = false;
      scroll.current?.scrollTo({ x: Math.max(0, (activeX.current ?? 0) - 24), animated: false });
    }, 50);
  };
  const onChipLayout = (chip: ChipItem, event: LayoutChangeEvent) => {
    if (expanded || !chip.active) return;
    activeX.current = event.nativeEvent.layout.x;
    scheduleReveal();
  };

  const items = (expanded ? boxChips.slice(0, boxCount) : lineChips.slice(0, lineCount)).map((chip) => (
    <Chip
      key={chip.key}
      label={chip.label}
      active={chip.active}
      testID={chip.testID}
      onPress={() => choose(chip)}
      onLayout={(event) => onChipLayout(chip, event)}
      hasTVPreferredFocus={Platform.isTV && expanded && chip.active && focusAfter === 'active'}
      // In the box, the box scrolls to the focused chip; centering it in the page scrolled the page down to the titles.
      centerOnFocus={!expanded}
    />
  ));

  const toggle = (
    <Toggle
      expanded={expanded}
      testID={testID && `${testID}-${expanded ? 'less' : 'all'}`}
      hasTVPreferredFocus={Platform.isTV && !expanded && focusAfter === 'toggle'}
      onPress={() => {
        reveal.current = expanded;
        setBoxLimit(BOX_PAGE);
        setFocusAfter(expanded ? 'toggle' : 'active');
        setExpanded(!expanded);
      }}
    />
  );

  if (expanded) {
    return (
      <View style={styles.expanded} testID={testID}>
        <FocusRow style={styles.header}>
          <Text style={styles.heading}>{label}</Text>
          {toggle}
        </FocusRow>
        <ScrollView
          testID={testID && `${testID}-box`}
          style={{ maxHeight: boxHeight }}
          nestedScrollEnabled
          accessibilityLabel={label}
          scrollEventThrottle={100}
          onScroll={(event) => nearEnd(event, false) && boxCount < chips.length && setBoxLimit(boxCount + BOX_PAGE)}
          onContentSizeChange={(_width, contentHeight) => setBoxContentHeight(contentHeight)}
        >
          <FocusRow style={styles.wrap}>{items}</FocusRow>
        </ScrollView>
      </View>
    );
  }

  // TV (D-094, D-105): "All", the categories that fit (at most TV_WINDOW), ‹ › to page through them, then "Show all" —
  // no long walk to reach the end. Long names take more room: fewer of them show, so the buttons stay on screen.
  if (Platform.isTV) {
    const rest = chips.slice(1);
    const needsPager = rest.length > TV_WINDOW || !fitsWhole(rest, 0, rest.length, tvRoomWithout());
    const room = needsPager ? tvRoomWith() : tvRoomWithout();
    // The last page is full: it starts as many chips before the end as fit.
    const lastFirst = Math.max(0, rest.length - fitCount(rest, rest.length - 1, room, -1));
    const first = Math.min(lastFirst, Math.max(0, tvStart ?? activeIndex - 2));
    const count = fitCount(rest, first, room, 1);
    const shown = [chips[0], ...rest.slice(first, first + count)].filter((chip): chip is ChipItem => !!chip);
    // Chips around the shown ones, measured off screen so the next and previous pages know how many fit.
    const measured = rest.slice(Math.max(0, first - TV_WINDOW), first + count + TV_WINDOW);
    return (
      <View style={styles.tvWrap}>
        <FocusRow style={[styles.bar, styles.tvBar]} testID={testID}>
          <View
            style={styles.tvMeasure}
            testID={testID && `${testID}-width`}
            onLayout={(event) => setTvWidth('bar', event.nativeEvent.layout.width)}
          />
          {shown.map((chip, index) => (
            <Chip
              key={chip.key}
              label={chip.label}
              active={chip.active}
              testID={chip.testID}
              onPress={() => choose(chip)}
              onLayout={index === 0 ? (event) => setTvWidth('all', event.nativeEvent.layout.width) : undefined}
            />
          ))}
          {needsPager ? (
            // Pinned to the right end, so ‹ › and "Show all" stay put whatever the shown categories' widths.
            <View style={styles.tvPager} testID={testID && `${testID}-pager`}>
              <PageButton
                direction="left"
                disabled={first === 0}
                testID={testID && `${testID}-prev`}
                onPress={() => setTvStart(Math.max(0, first - fitCount(rest, first - 1, room, -1)))}
                onLayout={(event) => setTvWidth('prev', event.nativeEvent.layout.width)}
              />
              <PageButton
                direction="right"
                disabled={first + count >= rest.length}
                testID={testID && `${testID}-next`}
                onPress={() => setTvStart(Math.min(lastFirst, first + count))}
                onLayout={(event) => setTvWidth('next', event.nativeEvent.layout.width)}
              />
              <View testID={testID && `${testID}-toggle-box`} onLayout={(event) => setTvWidth('toggle', event.nativeEvent.layout.width)}>
                {toggle}
              </View>
            </View>
          ) : null}
        </FocusRow>
        <View style={styles.tvHidden} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          {measured.map((chip) => (
            <View
              key={chip.key}
              style={styles.chip}
              testID={testID && `${testID}-measure-${chip.key}`}
              onLayout={(event) => setTvWidth(`chip:${chip.key}`, event.nativeEvent.layout.width)}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FocusRow style={styles.bar} testID={testID}>
      <ScrollView
        ref={scroll}
        testID={testID && `${testID}-line`}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.line}
        contentContainerStyle={styles.chips}
        accessibilityLabel={label}
        scrollEventThrottle={100}
        onScroll={(event) => nearEnd(event, true) && lineCount < chips.length && setLineLimit(lineCount + LINE_PAGE)}
        onLayout={(event) => setLineWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => {
          setContentWidth(width);
          scheduleReveal();
        }}
      >
        {items}
      </ScrollView>
      {overflows ? toggle : null}
    </FocusRow>
  );
}

/**
 * TV: ‹ or › — shows the previous or next categories. At the ends it is dimmed and does nothing, but stays enabled: a
 * disabled Android view loses the focus, which then jumped to a category chip, and a second OK chose it.
 */
function PageButton({
  direction,
  disabled,
  onPress,
  onLayout,
  testID,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onPress(): void;
  onLayout?(event: LayoutChangeEvent): void;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const centering = useCenterOnFocus();
  return (
    <Pressable
      ref={centering.ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? t('Previous categories') : t('Next categories')}
      onLayout={onLayout}
      onPress={() => !disabled && onPress()}
      onFocus={() => {
        setFocused(true);
        centering.center();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.chip, styles.pageButton, focused && styles.chipFocused, disabled && !focused && styles.dimmed]}
    >
      <Icon name={direction === 'left' ? 'chevronLeft' : 'chevronRight'} size={20} color={focused ? '#000' : colors.text} />
    </Pressable>
  );
}

/** "Show all ⌄" / "Show less ⌃": stays in the same place in both modes. */
function Toggle({
  expanded,
  onPress,
  hasTVPreferredFocus,
  testID,
}: {
  expanded: boolean;
  onPress(): void;
  hasTVPreferredFocus?: boolean;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const text = expanded ? t('Show less') : t('Show all');
  const centering = useCenterOnFocus();
  return (
    <Pressable
      ref={centering.ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={expanded ? t('Show fewer categories') : t('Show all categories')}
      accessibilityState={{ expanded }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        centering.center();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.chip, styles.toggle, focused && styles.chipFocused]}
    >
      {/* Focused, the button is white: dark text and arrow, as on a focused chip. */}
      <Text style={[styles.chipText, focused && styles.chipTextActive]}>{text}</Text>
      <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={18} color={focused ? '#000' : colors.text} />
    </Pressable>
  );
}

/** Web `.chip`: pill; the active one is white with black text. */
export function Chip({
  label,
  active,
  onPress,
  onLayout,
  hasTVPreferredFocus,
  centerOnFocus = true,
  testID,
}: {
  label: string;
  active: boolean;
  onPress(): void;
  onLayout?(event: LayoutChangeEvent): void;
  hasTVPreferredFocus?: boolean;
  /** TV: scroll the page so the chip is in the middle (D-094). Off in the "Show all" box (D-108). */
  centerOnFocus?: boolean;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const centering = useCenterOnFocus();
  return (
    <Pressable
      ref={centering.ref}
      testID={testID}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={onLayout}
      onFocus={() => {
        setFocused(true);
        if (centerOnFocus) centering.center();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.chip, active && styles.chipActive, focused && styles.chipFocused]}
    >
      <Text style={[styles.chipText, (active || focused) && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 24 },
  line: { flex: 1 },
  expanded: { marginBottom: 24, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { color: colors.muted, fontSize: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  chipActive: { borderColor: colors.strong, backgroundColor: colors.strong },
  // Focused: filled white with dark text and a glow, like a focused button.
  chipFocused: { borderColor: focus.solid, backgroundColor: focus.solid, ...focus.glow },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: '#000' },
  tvBar: { flexWrap: 'nowrap', alignItems: 'center' },
  tvWrap: { position: 'relative' },
  // Fills the bar's width behind the chips, to measure it.
  tvMeasure: { position: 'absolute', left: 0, right: 0, height: 0 },
  // Off-screen copies of the chips, only to measure their widths.
  tvHidden: { position: 'absolute', top: 0, left: 0, flexDirection: 'row', opacity: 0, gap: GAP },
  tvPager: { flexDirection: 'row', alignItems: 'center', gap: GAP, marginLeft: 'auto' },
  pageButton: { paddingHorizontal: 10 },
  dimmed: { opacity: 0.4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, backgroundColor: colors.raised },
});
