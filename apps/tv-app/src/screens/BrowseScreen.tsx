import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LibrarySection } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { useCatalog, useNav } from '../hooks';
import { colors, useSizes, useNavHeight } from '../theme';
import { TitleGrid } from './titles';

/** Same as the web Movies/Series page: title, category chips (All + provider categories), paged grid. */
export function BrowseScreen({ section }: { section: LibrarySection }) {
  const categories = useCatalog((s) => s.categories[section]?.data ?? []);
  const categoryId = useNav((s) => s.categoryId);
  const sizes = useSizes();
  const navH = useNavHeight();

  useEffect(() => {
    void stores.catalog.getState().loadCategories(section);
  }, [section]);

  const header = (
    <View style={{ paddingTop: navH + 24, paddingHorizontal: sizes.gutter }}>
      <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>{section === 'movies' ? 'Movies' : 'Series'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Categories">
        <Chip label="All" active={categoryId === null} onPress={() => navStore.getState().setCategory(null)} testID="chip-all" />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            active={categoryId === category.id}
            testID={`chip-${category.id}`}
            onPress={() => navStore.getState().setCategory(category.id)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <TitleGrid key={`${section}-${categoryId}`} section={section} categoryId={categoryId} header={header} testID={`browse-${section}`} />
  );
}

/** Web `.chip`: pill; the active one is white with black text. */
export function Chip({ label, active, onPress, testID }: { label: string; active: boolean; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.chip, active && styles.chipActive, focused && styles.chipFocused]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
  chips: { gap: 8, marginBottom: 24 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  chipActive: { borderColor: colors.strong, backgroundColor: colors.strong },
  chipFocused: { borderColor: colors.strong, borderWidth: 2, paddingVertical: 5, paddingHorizontal: 13 },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: '#000' },
});
