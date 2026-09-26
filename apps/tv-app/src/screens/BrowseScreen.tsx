import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_LIBRARY_SORT, sortChoiceKey, type LibrarySection } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { ChipBar } from '../components/ChipBar';
import { useCatalog, useLibrary, useNav } from '../hooks';
import { colors, useSizes, useNavHeight } from '../theme';
import { LibraryBanner } from '../components/LibraryBanner';
import { TitleGrid } from './titles';

/** Same as the web Movies/Series page: title, category chips (All + provider categories, expandable), sort, paged grid. */
export function BrowseScreen({ section, processing = false }: { section: LibrarySection; processing?: boolean }) {
  const categories = useCatalog((s) => s.categories[section]?.data ?? []);
  const categoryId = useNav((s) => s.categoryId);
  const sort = useLibrary((s) => s.sortChoices[section]) ?? DEFAULT_LIBRARY_SORT;
  const sizes = useSizes();
  const navH = useNavHeight();

  useEffect(() => {
    void stores.catalog.getState().loadCategories(section);
  }, [section]);

  const header = (
    <View style={{ paddingTop: navH + 24, paddingHorizontal: sizes.gutter }}>
      <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>{section === 'movies' ? 'Movies' : 'Series'}</Text>
      <ChipBar
        label="Categories"
        testID="chips"
        chips={[
          {
            key: 'all',
            label: 'All',
            active: categoryId === null,
            testID: 'chip-all',
            onPress: () => navStore.getState().setCategory(null),
          },
          ...categories.map((category) => ({
            key: category.id,
            label: category.name,
            active: categoryId === category.id,
            testID: `chip-${category.id}`,
            onPress: () => navStore.getState().setCategory(category.id),
          })),
        ]}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <TitleGrid
        key={`${section}-${categoryId}-${sortChoiceKey(sort)}`}
        section={section}
        categoryId={categoryId}
        sort={sort}
        onSort={(choice) => stores.library.getState().chooseSort(section, choice)}
        header={header}
        testID={`browse-${section}`}
        // First start: the library is still being organized, so the page is empty for now; the banner shows progress.
        emptyText={processing ? 'Your library is being organized. Titles appear here as soon as it is done.' : undefined}
      />
      <LibraryBanner processing={processing} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
});
