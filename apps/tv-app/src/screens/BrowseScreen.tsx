import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_LIBRARY_SORT, sortChoiceKey, type LibrarySection } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { ChipBar } from '../components/ChipBar';
import { useCatalog, useLibrary, useNav } from '../hooks';
import { colors, useSizes, useNavHeight } from '../theme';
import { TitleGrid } from './titles';

/** Same as the web Movies/Series page: title, category chips (All + provider categories, expandable), sort, paged grid. */
export function BrowseScreen({ section }: { section: LibrarySection }) {
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
    <TitleGrid
      key={`${section}-${categoryId}-${sortChoiceKey(sort)}`}
      section={section}
      categoryId={categoryId}
      sort={sort}
      onSort={(choice) => stores.library.getState().chooseSort(section, choice)}
      header={header}
      testID={`browse-${section}`}
    />
  );
}

const styles = StyleSheet.create({
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
});
