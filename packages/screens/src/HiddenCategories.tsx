import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_SECTIONS, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Chip } from './ui/ChipBar';
import { CheckRow } from './ui/CheckRow';
import { Dialog } from './ui/Dialog';
import { DialogActions } from './ui/DialogActions';
import { ErrorText } from './ui/Feedback';
import { Field } from './ui/Field';
import { FocusRow } from './ui/FocusRow';
import { CenteringScrollView } from './ui/CenterScroll';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → Profiles → Categories shown (D-110): the categories this profile browses, per section. An unchecked
 * category leaves the category bars, lists, Home rows and the guide; search still finds its titles and channels. The
 * choice is applied when saved: it reloads every list.
 */
export function HiddenCategories({ onClose }: { onClose(): void }) {
  const { section, setSection, categories, error, profileName, isShown, allShown, toggle, toggleAll, save } =
    useScreenHost().hooks.useHiddenCategories(onClose);

  const [filterText, setFilterText] = useState('');

  // Filter categories by name (case-insensitive)
  const filteredCategories = useMemo(
    () => (categories ?? []).filter((cat) => filterText === '' || cat.name.toLowerCase().includes(filterText.toLowerCase())),
    [categories, filterText],
  );

  // Clear filter when section changes
  useEffect(() => {
    setFilterText('');
  }, [section]);

  return (
    <Dialog
      title={profileName ? t('Categories shown to {name}', { name: profileName }) : t('Categories shown')}
      onClose={onClose}
      testID="hidden-categories"
      tall
      actions={<DialogActions onSave={() => void save()} onCancel={onClose} saveTestID="hidden-categories-save" />}
    >
      <FocusRow style={styles.sections}>
        {CATEGORY_SECTIONS.map((s) => (
          <Chip
            key={s.section}
            label={s.label()}
            active={section === s.section}
            onPress={() => setSection(s.section)}
            testID={`hidden-section-${s.section}`}
          />
        ))}
      </FocusRow>
      <Text style={styles.hint}>
        {t('Unchecked categories are left out of browsing: the category bar, the lists, Home and the guide. Search still finds them.')}
      </Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {categories ? (
        // CenteringScrollView keeps focus navigation working for all items on TV (issue #338).
        <CenteringScrollView style={styles.list} contentContainerStyle={styles.listContent} testID="hidden-categories-list" onlyCentering>
          <View style={styles.filterInput}>
            <Field
              label={t('Filter categories')}
              value={filterText}
              onChange={setFilterText}
              placeholder={t('Filter categories')}
              testID="category-filter"
              autoFocus={false}
              compact
            />
          </View>
          {filteredCategories.length ? (
            <CheckRow label={t('Select all')} checked={allShown} onPress={toggleAll} testID="hidden-categories-all" />
          ) : (
            <Text style={styles.hint}>{t('No categories.')}</Text>
          )}
          {filteredCategories.map((category) => (
            <CheckRow
              key={category.id}
              label={category.name}
              checked={isShown(category.id)}
              onPress={() => toggle(category.id)}
              testID={`hidden-category-${category.name}`}
            />
          ))}
        </CenteringScrollView>
      ) : error ? null : (
        <ActivityIndicator color={colors.accent} />
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.muted, fontSize: fonts.small },
  // Fills the room between the fixed parts of a tall dialog and scrolls there, so Save stays in view (DECISIONS.md#d-231).
  list: { flex: 1 },
  listContent: { gap: 2 },
  filterInput: { marginBottom: 8 },
});
