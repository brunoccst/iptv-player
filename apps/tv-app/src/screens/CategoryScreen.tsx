import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { LibrarySection } from '@iptv/shared';
import { navStore } from '../appContext';
import { useNav } from '../hooks';
import { ErrorText, errorText, Loading } from '../components/Feedback';
import { PosterCard } from '../components/PosterCard';
import { card, colors, fonts, safe, spacing } from '../theme';
import { usePagedLibrary } from './usePagedLibrary';

const PAGE_SIZE = 60;
const CARD_GAP = spacing.md;

/** One category (or "All") as a grid; the next page loads near the bottom with a spinner. Opened from a row title. */
export function CategoryScreen({ section, categoryId, title }: { section: LibrarySection; categoryId: string | null; title: string }) {
  const page = usePagedLibrary(section, { categoryId }, PAGE_SIZE);
  const { width } = useWindowDimensions();
  const railWidth = useNav((s) => (s.railCollapsed ? 56 : 150));
  const columns = Math.max(2, Math.floor((width - railWidth - safe.horizontal * 2) / (card.width + CARD_GAP)));

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {page.total > 0 ? <Text style={styles.total}>{`${page.total.toLocaleString('en-US')} titles`}</Text> : null}
    </View>
  );

  if (page.loadingFirst) return <Loading label={`Loading ${title}`} />;
  return (
    <FlatList
      key={columns}
      testID={`category-${section}-${categoryId ?? 'all'}`}
      style={styles.screen}
      data={page.items}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.gridRow}
      ListHeaderComponent={header}
      ListEmptyComponent={page.error ? <ErrorText>{errorText(page.error)}</ErrorText> : <Text style={styles.count}>No titles found.</Text>}
      renderItem={({ item, index }) => (
        <PosterCard
          title={item.title}
          posterUrl={item.posterUrl}
          badge={item.bestQuality === '4K' ? '4K' : null}
          subtitle={[item.year, item.variantCount > 1 ? `${item.variantCount} versions` : null].filter(Boolean).join(' · ') || null}
          hasTVPreferredFocus={index === 0}
          onPress={() => navStore.getState().push({ name: 'details', section, masterId: item.id })}
        />
      )}
      onEndReached={page.loadMore}
      onEndReachedThreshold={1.5}
      ListFooterComponent={
        page.loadingMore ? (
          <ActivityIndicator style={styles.more} size="large" color={colors.accent} accessibilityLabel="Loading more" />
        ) : null
      }
      initialNumToRender={columns * 3}
      maxToRenderPerBatch={columns * 2}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, marginLeft: safe.horizontal, marginBottom: spacing.md },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700' },
  total: { color: colors.muted, fontSize: fonts.body },
  count: { color: colors.muted, fontSize: fonts.body, marginLeft: safe.horizontal },
  gridRow: { gap: CARD_GAP, paddingHorizontal: safe.horizontal, marginBottom: CARD_GAP },
  more: { marginVertical: spacing.xl },
});
