import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
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

  return (
    <ScrollView style={styles.screen} testID={`browse-${section}`}>
      <Text style={styles.title}>{section === 'movies' ? 'Movies' : 'Series'}</Text>
      <LibraryRow section={section} title="All" />
      {categories.map((category) => <LibraryRow key={category.id} section={section} category={category} title={category.name} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700', marginLeft: safe.horizontal, marginBottom: 12 },
});
