import { useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, safe, spacing } from '../theme';

interface RowProps<T> {
  title: string;
  items: T[];
  keyOf(item: T): string;
  render(item: T, index: number): ReactElement;
  empty?: string;
  testID?: string;
  /** Makes the title a link ("Drama ›"), e.g. to open the whole category. */
  onTitlePress?(): void;
  /** First items still loading: a spinner instead of the empty text. */
  loading?: boolean;
  /** Next page loading: a spinner after the last card. */
  loadingMore?: boolean;
  onEndReached?(): void;
}

/** Horizontal row. Android's focus search moves between cards; the list scrolls to the focused one. */
export function Row<T>({ title, items, keyOf, render, empty, testID, onTitlePress, loading, loadingMore, onEndReached }: RowProps<T>) {
  return (
    <View style={styles.row} testID={testID} accessibilityLabel={title}>
      {onTitlePress ? (
        <TitleLink title={title} onPress={onTitlePress} testID={testID && `${testID}-open`} />
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}
      {items.length === 0 ? (
        loading ? (
          <ActivityIndicator style={styles.spinner} color={colors.accent} accessibilityLabel="Loading" />
        ) : (
          <Text style={styles.empty}>{empty ?? ' '}</Text>
        )
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={keyOf}
          renderItem={({ item, index }) => render(item, index)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.content}
          removeClippedSubviews={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          onEndReached={onEndReached}
          onEndReachedThreshold={1.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.more} color={colors.accent} accessibilityLabel="Loading more" /> : null
          }
        />
      )}
    </View>
  );
}

function TitleLink({ title, onPress, testID }: { title: string; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={`Open ${title}`}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.link, focused && styles.linkFocused]}
    >
      <Text style={[styles.title, styles.linkText, focused && styles.linkTextFocused]}>{`${title} ›`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: fonts.heading, fontWeight: '700', marginLeft: safe.horizontal, marginBottom: spacing.sm },
  link: {
    alignSelf: 'flex-start',
    marginLeft: safe.horizontal - spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  linkFocused: { backgroundColor: colors.strong },
  linkText: { marginLeft: 0, marginBottom: 0 },
  linkTextFocused: { color: '#000' },
  content: { paddingHorizontal: safe.horizontal, paddingVertical: spacing.sm },
  empty: { color: colors.muted, marginLeft: safe.horizontal },
  spinner: { alignSelf: 'flex-start', marginLeft: safe.horizontal, marginVertical: spacing.lg },
  more: { alignSelf: 'center', marginHorizontal: spacing.lg },
});
