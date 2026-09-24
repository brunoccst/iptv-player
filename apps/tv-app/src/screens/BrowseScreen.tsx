import { useEffect } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import type { LibrarySection } from '@iptv/shared';
import { stores } from '../appContext';
import { useCatalog } from '../hooks';
import { colors, fonts, safe } from '../theme';
import { LibraryRow } from './LibraryRow';

/** Movies or Series: one row per provider category (TV-friendly alternative to a filter + grid). */
export function BrowseScreen({ section }: { section: LibrarySection }) {
  const categories = useCatalog((s) => s.categories[section]?.data ?? []);

  useEffect(() => {
    void stores.catalog.getState().loadCategories(section);
  }, [section]);

  // Providers have hundreds of categories: only rows near the screen are mounted (and load their titles).
  const rows = [null, ...categories];
  return (
    <FlatList
      style={styles.screen}
      testID={`browse-${section}`}
      data={rows}
      keyExtractor={(row) => row?.id ?? '*'}
      ListHeaderComponent={<Text style={styles.title}>{section === 'movies' ? 'Movies' : 'Series'}</Text>}
      renderItem={({ item }) => <LibraryRow section={section} category={item ?? undefined} title={item?.name ?? 'All'} />}
      initialNumToRender={3}
      maxToRenderPerBatch={2}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700', marginLeft: safe.horizontal, marginBottom: 12 },
});
