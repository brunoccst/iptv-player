import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_LIBRARY_SORT, sortChoiceKey, type LibrarySection, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { TitleGrid } from './TitleGrid';
import { ChipBar } from './ui/ChipBar';
import { colors, useNavHeight, useSizes } from './ui/theme';

/**
 * Movies or Series (D-079): title, category chips (All + provider categories, expandable, D-047), "Sort by" and the
 * paged grid of titles. One screen for TV, phone and desktop (DECISIONS.md#d-195). `banner`: the library's progress or
 * notice under the title; `overlay`: anything the app lays over the page (the TV's library banner).
 */
export function BrowseScreen({
  section,
  emptyText,
  banner,
  overlay,
}: {
  section: LibrarySection;
  /** Text when there are no titles (the library is still being organized). */
  emptyText?: string;
  banner?: ReactNode;
  overlay?: ReactNode;
}) {
  const { hooks, stores, useCategory, setCategory } = useScreenHost();
  const categories = hooks.useCatalog((s) => s.categories[section]?.data ?? []);
  const categoryId = useCategory();
  const sort = hooks.useLibrary((s) => s.sortChoices[section]) ?? DEFAULT_LIBRARY_SORT;
  const sizes = useSizes();
  const navH = useNavHeight();

  useEffect(() => {
    void stores.catalog.getState().loadCategories(section);
  }, [section, stores]);

  const header = (
    // On desktop the app's page already leaves room for the nav.
    <View style={{ paddingTop: Platform.OS === 'web' ? 0 : navH + 24, paddingHorizontal: sizes.gutter }}>
      <Text accessibilityRole="header" style={[styles.title, { fontSize: sizes.pageTitle }]}>
        {section === 'movies' ? t('Movies') : t('Series')}
      </Text>
      {banner}
      <ChipBar
        label={t('Categories')}
        testID="chips"
        chips={[
          { key: 'all', label: t('All'), active: categoryId === null, testID: 'chip-all', onPress: () => setCategory(null) },
          ...categories.map((category) => ({
            key: category.id,
            label: category.name,
            active: categoryId === category.id,
            testID: `chip-${category.id}`,
            onPress: () => setCategory(category.id),
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
        emptyText={emptyText}
      />
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
});
