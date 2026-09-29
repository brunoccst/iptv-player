import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_SECTIONS, t } from '@iptv/shared';

import { useKidsCategories } from '../hooks';
import { colors, fonts } from '../theme';
import { Chip } from './ChipBar';
import { ErrorText } from './Feedback';
import { FocusButton } from './FocusButton';
import { Icon } from './Icon';
import { focus } from './focus';

/**
 * Profile editor → Choose categories (D-064): the categories a Kids profile may see, per section. Starts from the
 * automatic choice (category names, D-053); "Automatic" goes back to it. Saved on this device with the profile.
 */
export function KidsCategories({ profileId, name, onClose }: { profileId: string; name: string; onClose(): void }) {
  const { section, setSection, categories, error, chosen, isPicked, toggle, automatic, save } = useKidsCategories(profileId, onClose);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="kids-categories">
          <Text style={styles.title}>{t('Categories for {name}', { name })}</Text>
          <View style={styles.sections}>
            {CATEGORY_SECTIONS.map((s) => (
              <Chip
                key={s.section}
                label={s.label()}
                active={section === s.section}
                onPress={() => setSection(s.section)}
                testID={`kids-section-${s.section}`}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            {chosen ? t('Chosen by you.') : t('Automatic: categories whose names say they are for kids.')}{' '}
            {t('Only checked categories are shown.')}
          </Text>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {categories ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {categories.length === 0 ? <Text style={styles.hint}>{t('No categories.')}</Text> : null}
              {categories.map((category) => (
                <CategoryRow key={category.id} name={category.name} checked={isPicked(category.id)} onPress={() => toggle(category.id)} />
              ))}
            </ScrollView>
          ) : error ? null : (
            <ActivityIndicator color={colors.accent} />
          )}
          <View style={styles.actions}>
            <FocusButton label={t('Save')} variant="primary" onPress={() => void save()} testID="kids-categories-save" />
            <FocusButton label={t('Automatic')} variant="ghost" disabled={!chosen} onPress={automatic} testID="kids-categories-automatic" />
            <FocusButton label={t('Cancel')} variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CategoryRow({ name, checked, onPress }: { name: string; checked: boolean; onPress(): void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={name}
      testID={`kids-category-${name}`}
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
    width: 520,
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
  listContent: { gap: 2 },
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
