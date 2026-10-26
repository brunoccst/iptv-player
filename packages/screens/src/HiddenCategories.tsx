import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';
import { CATEGORY_SECTIONS, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Chip } from './ui/ChipBar';
import { CheckRow } from './ui/CheckRow';
import { Dialog } from './ui/Dialog';
import { DialogActions } from './ui/DialogActions';
import { ErrorText } from './ui/Feedback';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → Profiles → Categories shown (D-110): the categories this profile browses, per section. An unchecked
 * category leaves the category bars, lists, Home rows and the guide; search still finds its titles and channels. The
 * choice is applied when saved: it reloads every list.
 */
export function HiddenCategories({ onClose }: { onClose(): void }) {
  const { section, setSection, categories, error, profileName, isShown, allShown, toggle, toggleAll, save } =
    useScreenHost().hooks.useHiddenCategories(onClose);

  return (
    <Dialog
      title={profileName ? t('Categories shown to {name}', { name: profileName }) : t('Categories shown')}
      onClose={onClose}
      testID="hidden-categories"
      tall
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
        // Providers send hundreds of categories: only the rows near the focus are drawn.
        <FlatList
          style={styles.list}
          data={categories}
          keyExtractor={(category) => category.id}
          initialNumToRender={12}
          windowSize={5}
          ListHeaderComponent={
            categories.length ? (
              <CheckRow label={t('Select all')} checked={allShown} onPress={toggleAll} testID="hidden-categories-all" />
            ) : null
          }
          ListEmptyComponent={<Text style={styles.hint}>{t('No categories.')}</Text>}
          renderItem={({ item }) => (
            <CheckRow
              label={item.name}
              checked={isShown(item.id)}
              onPress={() => toggle(item.id)}
              testID={`hidden-category-${item.name}`}
            />
          )}
        />
      ) : error ? null : (
        <ActivityIndicator color={colors.accent} />
      )}
      <DialogActions onSave={() => void save()} onCancel={onClose} saveTestID="hidden-categories-save" />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.muted, fontSize: fonts.small },
  // Fills the room between the fixed parts of a tall dialog and scrolls there, so Save stays in view (DECISIONS.md#d-231).
  list: { flex: 1 },
});
