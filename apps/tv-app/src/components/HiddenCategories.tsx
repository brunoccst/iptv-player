import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_SECTIONS, t } from '@iptv/shared';

import { useHiddenCategories } from '../hooks';
import { colors, fonts } from '../theme';
import { Chip } from './ChipBar';
import { ErrorText } from './Feedback';
import { FocusButton } from './FocusButton';
import { Icon } from './Icon';
import { focus } from './focus';

/**
 * Account menu → Profiles → Categories shown (D-110): the categories this profile browses, per section. An unchecked
 * category leaves the category bars, lists, Home rows and the guide; search still finds its titles and channels. The
 * choice is applied when saved: it reloads every list.
 */
export function HiddenCategories({ onClose }: { onClose(): void }) {
  const { section, setSection, categories, error, profileName, isShown, allShown, toggle, toggleAll, save } = useHiddenCategories(onClose);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="hidden-categories">
          <Text style={styles.title}>{profileName ? t('Categories shown to {name}', { name: profileName }) : t('Categories shown')}</Text>
          <View style={styles.sections}>
            {CATEGORY_SECTIONS.map((s) => (
              <Chip
                key={s.section}
                label={s.label()}
                active={section === s.section}
                onPress={() => setSection(s.section)}
                testID={`hidden-section-${s.section}`}
              />
            ))}
          </View>
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
                  <CategoryRow name={t('Select all')} checked={allShown} onPress={toggleAll} testID="hidden-categories-all" />
                ) : null
              }
              ListEmptyComponent={<Text style={styles.hint}>{t('No categories.')}</Text>}
              renderItem={({ item }) => <CategoryRow name={item.name} checked={isShown(item.id)} onPress={() => toggle(item.id)} />}
            />
          ) : error ? null : (
            <ActivityIndicator color={colors.accent} />
          )}
          <View style={styles.actions}>
            <FocusButton label={t('Save')} variant="primary" onPress={() => void save()} testID="hidden-categories-save" />
            <FocusButton label={t('Cancel')} variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CategoryRow({ name, checked, onPress, testID }: { name: string; checked: boolean; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={name}
      testID={testID ?? `hidden-category-${name}`}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.row, focused && styles.rowFocused]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Icon name="check" size={16} color="#000" /> : null}</View>
      <Text style={styles.rowText} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 560,
    maxWidth: '100%',
    maxHeight: '92%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  sections: { flexDirection: 'row', gap: 8 },
  hint: { color: colors.muted, fontSize: fonts.small },
  list: { flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  rowFocused: { backgroundColor: focus.fill },
  rowText: { color: colors.text, fontSize: fonts.small, flexShrink: 1 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.strong, borderColor: colors.strong },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
