import { useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, useSizes } from '../theme';
import { Icon } from './Icon';
import { focus } from './focus';
import { FocusRow, useRowFocus } from './FocusRow';

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
  return (
    <View style={[styles.row, { marginBottom: sizes.rowGap }]} testID={testID} accessibilityLabel={title}>
      <View style={[styles.header, { marginHorizontal: sizes.gutter }]}>
        {onTitlePress ? (
          <TitleLink title={title} fontSize={sizes.rowTitle} onPress={onTitlePress} testID={testID && `${testID}-open`} />
        ) : (
          <Text style={[styles.title, { fontSize: sizes.rowTitle }]}>{title}</Text>
        )}
      </View>
      {items.length === 0 ? (
        loading ? (
          <ActivityIndicator style={[styles.spinner, { marginLeft: sizes.gutter }]} color={colors.accent} accessibilityLabel="Loading" />
        ) : (
          <Text style={[styles.empty, { marginHorizontal: sizes.gutter }]}>{empty ?? ' '}</Text>
        )
      ) : (
        <FocusRow>
          <FlatList
            horizontal
            data={items}
            keyExtractor={keyOf}
            renderItem={({ item, index }) => render(item, index)}
            ItemSeparatorComponent={Separator}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingHorizontal: sizes.gutter }]}
            removeClippedSubviews={false}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={5}
            ListFooterComponent={
              more ? <MoreCard title={title} landscape={more.landscape} onPress={more.onPress} testID={testID && `${testID}-more`} /> : null
            }
          />
        </FocusRow>
      )}
    </View>
  );
}

const Separator = () => <View style={{ width: 8 }} />;

/** Card-sized arrow after the last title: opens the category page. Same parts as a card (art, then a title line), so
 * it lines up with landscape (live) cards too. */
function MoreCard({ title, landscape, onPress, testID }: { title: string; landscape?: boolean; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  const rowFocus = useRowFocus();
  const { cardWidth } = useSizes();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={`See all: ${title}`}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        rowFocus?.();
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
        See all
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
      accessibilityLabel={`Open ${title}`}
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
  empty: { color: colors.muted },
  spinner: { alignSelf: 'flex-start', marginVertical: 24 },
  moreCard: { borderRadius: radius + 2, borderWidth: 2, borderColor: 'transparent' },
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
