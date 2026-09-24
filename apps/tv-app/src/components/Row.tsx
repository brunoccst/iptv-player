import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, safe, spacing } from '../theme';

interface RowProps<T> {
  title: string;
  items: T[];
  keyOf(item: T): string;
  render(item: T, index: number): ReactElement;
  empty?: string;
  testID?: string;
}

/** Horizontal row. Android's focus search moves between cards; the list scrolls to the focused one. */
export function Row<T>({ title, items, keyOf, render, empty, testID }: RowProps<T>) {
  return (
    <View style={styles.row} testID={testID} accessibilityLabel={title}>
      <Text style={styles.title}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{empty ?? ' '}</Text>
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: fonts.heading, fontWeight: '700', marginLeft: safe.horizontal, marginBottom: spacing.sm },
  content: { paddingHorizontal: safe.horizontal, paddingVertical: spacing.sm },
  empty: { color: colors.muted, marginLeft: safe.horizontal },
});
