import { useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, useSizes } from '../theme';
import { Icon } from './Icon';

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
  /** Next page loading: a spinner after the last card. */
  loadingMore?: boolean;
  onEndReached?(): void;
}

/** Web `.row`: title (optionally a link) + horizontal track of cards. D-pad focus search moves between cards. */
export function Row<T>({ title, items, keyOf, render, empty, testID, onTitlePress, loading, loadingMore, onEndReached }: RowProps<T>) {
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

const Separator = () => <View style={{ width: 8 }} />;

function TitleLink({ title, fontSize, onPress, testID }: { title: string; fontSize: number; onPress(): void; testID?: string }) {
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
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius,
    marginHorizontal: -4,
    paddingHorizontal: 2,
  },
  linkFocused: { borderColor: colors.strong },
  linkTextFocused: { color: colors.strong, textDecorationLine: 'underline' },
  content: { paddingVertical: 8 },
  empty: { color: colors.muted },
  spinner: { alignSelf: 'flex-start', marginVertical: 24 },
  more: { alignSelf: 'center', marginHorizontal: 24 },
});
