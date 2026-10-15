import { useCallback, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, useSizes } from '../theme';
import { Icon } from './Icon';
import { focus } from './focus';
import { FocusRow, RowReveal, useRowFocus, useRowReveal } from './FocusRow';
import type { Measurable } from './CenterScroll';
import { revealOffset, tvRowInset } from './rowReveal';
import { t } from '@iptv/shared';

interface RowProps<T> {
  title: string;
  items: T[];
  keyOf(item: T): string;
  render(item: T, index: number): ReactElement;
  empty?: string;
  testID?: string;
  /** Makes the title a link ("Drama ›"), like the web row titles. */
  onTitlePress?(): void;
  /** First items still loading: a spinner instead of the empty text. */
  loading?: boolean;
  /** Last card: an arrow that opens the full list (Home rows show only the first few titles). */
  more?: { onPress(): void; landscape?: boolean };
}

/** Web `.row`: title (optionally a link) + horizontal track of cards. D-pad focus search moves between cards. */
export function Row<T>({ title, items, keyOf, render, empty, testID, onTitlePress, loading, more }: RowProps<T>) {
  const sizes = useSizes();
  // TV: the cards start further in than the page gutter, and the focused card keeps that distance from both screen
  // sides (DECISIONS.md#d-181). The title lines up with the cards.
  const inset = Platform.isTV ? tvRowInset(sizes.gutter) : sizes.gutter;
  const list = useRef<FlatList<T>>(null);
  const track = useRef({ offset: 0, viewport: 0, content: 0 });
  const reveal = useCallback(
    (target: Measurable | null) => {
      const inner = (list.current?.getNativeScrollRef() as { getInnerViewRef?(): unknown } | null | undefined)?.getInnerViewRef?.();
      if (!target || !inner) return;
      target.measureLayout(
        inner,
        (x, _y, width) => {
          const now = track.current;
          if (!now.viewport) return;
          // From the offset last asked for, not the one on screen: that is stale while a scroll animates (like D-094).
          const next = revealOffset(x, width, now.offset, now.viewport, now.content, inset);
          if (next === now.offset) return;
          now.offset = next;
          list.current?.scrollToOffset({ offset: next, animated: true });
        },
        () => undefined,
      );
    },
    [inset],
  );
  const settled = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    track.current.offset = event.nativeEvent.contentOffset.x;
  };
  return (
    <View style={[styles.row, { marginBottom: sizes.rowGap }]} testID={testID} accessibilityLabel={title}>
      <FocusRow style={[styles.header, { marginHorizontal: inset }]}>
        {onTitlePress ? (
          <TitleLink title={title} fontSize={sizes.rowTitle} onPress={onTitlePress} testID={testID && `${testID}-open`} />
        ) : (
          <Text style={[styles.title, { fontSize: sizes.rowTitle }]}>{title}</Text>
        )}
      </FocusRow>
      {items.length === 0 ? (
        loading ? (
          <ActivityIndicator style={[styles.spinner, { marginLeft: inset }]} color={colors.accent} accessibilityLabel={t('Loading')} />
        ) : (
          <Text style={[styles.empty, { marginHorizontal: inset }]}>{empty ?? ' '}</Text>
        )
      ) : (
        <FocusRow>
          <RowReveal.Provider value={Platform.isTV ? reveal : null}>
            <FlatList
              ref={list}
              horizontal
              data={items}
              keyExtractor={keyOf}
              renderItem={({ item, index }) => render(item, index)}
              ItemSeparatorComponent={Separator}
              showsHorizontalScrollIndicator={false}
              // TV: room above and below for the focused card (it grows 8 % and glows); the scroll view clips its content,
              // and the ring and glow were cut off at the top and bottom. The negative margin keeps the page layout.
              style={Platform.isTV ? styles.tvTrack : undefined}
              contentContainerStyle={[styles.content, Platform.isTV && styles.tvContent, { paddingHorizontal: inset }]}
              // TV: the row scrolls only through `reveal`; Android's own focus scrolling stopped with the card on the
              // screen edge (DECISIONS.md#d-181).
              scrollsChildToFocus={Platform.isTV ? false : undefined}
              onLayout={(event) => {
                track.current.viewport = event.nativeEvent.layout.width;
              }}
              onContentSizeChange={(width) => {
                track.current.content = width;
              }}
              onScrollEndDrag={settled}
              onMomentumScrollEnd={settled}
              removeClippedSubviews={false}
              // TV: all cards at once (rows hold at most ~10). Holding Right outran a list that was still drawing its last
              // cards, and focus fell out of the row (to the nav).
              initialNumToRender={Platform.isTV ? items.length : 8}
              maxToRenderPerBatch={Platform.isTV ? items.length : 6}
              windowSize={Platform.isTV ? 21 : 5}
              ListFooterComponent={
                more ? (
                  <MoreCard title={title} landscape={more.landscape} onPress={more.onPress} testID={testID && `${testID}-more`} />
                ) : null
              }
            />
          </RowReveal.Provider>
        </FocusRow>
      )}
    </View>
  );
}

/** Space above and below a TV row's cards for the focused card's growth (8 %) and glow. */
const TV_FOCUS_ROOM = 32;

const Separator = () => <View style={{ width: 8 }} />;

/** Card-sized arrow after the last title: opens the category page. Same parts as a card (art, then a title line), so
 * it lines up with landscape (live) cards too. */
function MoreCard({ title, landscape, onPress, testID }: { title: string; landscape?: boolean; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  const rowFocus = useRowFocus();
  const rowReveal = useRowReveal();
  const self = useRef<View>(null);
  const { cardWidth } = useSizes();
  return (
    <Pressable
      ref={self}
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={t('See all: {title}', { title })}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        rowFocus?.();
        rowReveal?.(self.current);
      }}
      onBlur={() => setFocused(false)}
      style={[styles.moreCard, { width: cardWidth, marginLeft: 8 }, focused && styles.moreFocused]}
    >
      <View style={[styles.moreArt, { aspectRatio: landscape ? 16 / 9 : 2 / 3 }]}>
        <View style={[styles.moreCircle, landscape && styles.moreCircleSmall, focused && styles.moreCircleFocused]}>
          <Icon name="chevronRight" size={landscape ? 22 : 32} color={focused ? colors.bg : colors.strong} />
        </View>
      </View>
      <Text style={styles.moreText} numberOfLines={1}>
        {t('See all')}
      </Text>
    </Pressable>
  );
}

function TitleLink({ title, fontSize, onPress, testID }: { title: string; fontSize: number; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  const rowFocus = useRowFocus();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={t('Open {title}', { title })}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        rowFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.link, focused && styles.linkFocused]}
    >
      <Text style={[styles.title, { fontSize }, focused && styles.linkTextFocused]}>{title}</Text>
      <Icon name="chevronRight" size={18} color={focused ? colors.strong : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {},
  header: { marginBottom: 10, flexDirection: 'row' },
  title: { color: colors.text, fontWeight: '700' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  // Focused: a translucent pill behind the row title.
  linkFocused: { backgroundColor: focus.fill },
  linkTextFocused: { color: colors.strong },
  content: { paddingVertical: 8 },
  tvContent: { paddingVertical: TV_FOCUS_ROOM },
  tvTrack: { marginVertical: 8 - TV_FOCUS_ROOM },
  empty: { color: colors.muted },
  spinner: { alignSelf: 'flex-start', marginVertical: 24 },
  // Like a card (PosterCard): the whole card has the background and fills the row's height, so it lines up with cards
  // that have a second line under the title.
  moreCard: { flex: 1, borderRadius: radius + 2, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  moreFocused: { transform: [{ scale: 1.08 }], borderColor: focus.ring, ...focus.glow },
  moreArt: {
    width: '100%',
    borderRadius: radius,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  moreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCircleSmall: { width: 40, height: 40, borderRadius: 20 },
  moreCircleFocused: { backgroundColor: colors.strong },
  // Same spacing and size as a card's title line (PosterCard `meta` + `title`).
  moreText: { color: colors.strong, fontSize: 13.6, fontWeight: '700', paddingTop: 8, paddingHorizontal: 4, paddingBottom: 4 },
});
