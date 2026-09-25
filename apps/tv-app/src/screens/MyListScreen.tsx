import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { watchlistCard } from '@iptv/shared';
import { useWatchlist } from '../hooks';
import { colors, useNavHeight, useSizes } from '../theme';
import { MasterCardItem, useGridColumns } from './titles';

/** Web "My List": titles the active profile saved, newest first (D-055). */
export function MyListScreen() {
  const items = useWatchlist((s) => s.items);
  const { columns, itemWidth } = useGridColumns();
  const sizes = useSizes();
  const navH = useNavHeight();
  const list = items.data ?? [];
  const lines = Array.from({ length: Math.ceil(list.length / columns) }, (_, i) => list.slice(i * columns, (i + 1) * columns));

  return (
    <ScrollView style={styles.screen} testID="mylist-screen" contentContainerStyle={{ paddingTop: navH + 24, paddingBottom: 60 }}>
      <Text style={[styles.title, { fontSize: sizes.pageTitle, marginHorizontal: sizes.gutter }]}>My List</Text>
      {items.status === 'loading' && !items.data ? (
        <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Loading" />
      ) : list.length === 0 ? (
        <Text style={[styles.muted, { marginHorizontal: sizes.gutter }]}>
          Add movies and series with the + button on their details to watch them later.
        </Text>
      ) : (
        lines.map((line, row) => (
          <View key={row} style={[styles.line, { paddingHorizontal: sizes.gutter }]}>
            {line.map((item, column) => (
              <MasterCardItem
                key={`${item.section}-${item.masterId}`}
                section={item.section}
                item={watchlistCard(item)}
                width={itemWidth}
                hasTVPreferredFocus={row === 0 && column === 0}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
  muted: { color: colors.muted, fontSize: 16 },
  line: { flexDirection: 'row', gap: 8, marginBottom: 24 },
});
