import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isKidsCategory, type CatalogSection, type MediaCategory } from '@iptv/shared';
import { api, stores } from '../appContext';
import { colors, fonts, radius } from '../theme';
import { Chip } from './ChipBar';
import { ErrorText } from './Feedback';
import { FocusButton } from './FocusButton';
import { Icon } from './Icon';

const SECTIONS: { section: CatalogSection; label: string }[] = [
  { section: 'movies', label: 'Movies' },
  { section: 'series', label: 'Series' },
  { section: 'live', label: 'Live TV' },
];

type Picks = Partial<Record<CatalogSection, string[] | null>>;

/**
 * Profile editor → Choose categories (D-064): the categories a Kids profile may see, per section. Starts from the
 * automatic choice (category names, D-053); "Automatic" goes back to it. Saved on this device with the profile.
 */
export function KidsCategories({ profileId, name, onClose }: { profileId: string; name: string; onClose(): void }) {
  const saved = stores.profilePrefs.getState().prefs[profileId]?.kidsCategories ?? {};
  const [section, setSection] = useState<CatalogSection>('movies');
  const [lists, setLists] = useState<Partial<Record<CatalogSection, MediaCategory[]>>>({});
  const [picks, setPicks] = useState<Picks>(saved);
  const [error, setError] = useState<string | null>(null);
  const categories = lists[section];

  useEffect(() => {
    if (lists[section]) return;
    // The profile picker has no active profile, so this is the full, unfiltered list.
    api.catalog
      .categories(section)
      .then((list) => setLists((current) => ({ ...current, [section]: list })))
      .catch(() => setError('The categories could not be loaded.'));
  }, [section, lists]);

  const automatic = (list: MediaCategory[]) => list.filter((c) => isKidsCategory(c.name)).map((c) => c.id);
  const picked = (list: MediaCategory[]) => picks[section] ?? automatic(list);
  const toggle = (list: MediaCategory[], id: string) => {
    const current = picked(list);
    setPicks({ ...picks, [section]: current.includes(id) ? current.filter((c) => c !== id) : [...current, id] });
  };
  const save = async () => {
    await stores.profilePrefs.getState().update(profileId, { kidsCategories: picks });
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="kids-categories">
          <Text style={styles.title}>Categories for {name}</Text>
          <View style={styles.sections}>
            {SECTIONS.map((s) => (
              <Chip
                key={s.section}
                label={s.label}
                active={section === s.section}
                onPress={() => setSection(s.section)}
                testID={`kids-section-${s.section}`}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            {picks[section] ? 'Chosen by you.' : 'Automatic: categories whose names say they are for kids.'} Only checked categories are
            shown.
          </Text>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {categories ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {categories.length === 0 ? <Text style={styles.hint}>No categories.</Text> : null}
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  name={category.name}
                  checked={picked(categories).includes(category.id)}
                  onPress={() => toggle(categories, category.id)}
                />
              ))}
            </ScrollView>
          ) : error ? null : (
            <ActivityIndicator color={colors.accent} />
          )}
          <View style={styles.actions}>
            <FocusButton label="Save" variant="primary" onPress={() => void save()} testID="kids-categories-save" />
            <FocusButton
              label="Automatic"
              variant="ghost"
              disabled={!picks[section]}
              onPress={() => setPicks({ ...picks, [section]: null })}
              testID="kids-categories-automatic"
            />
            <FocusButton label="Cancel" variant="ghost" onPress={onClose} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: radius },
  rowFocused: { backgroundColor: colors.raised },
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
