import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { selectActiveProfile, type CatalogSection, type MediaCategory, t } from '@iptv/shared';
import { api, navStore, stores } from '../appContext';
import { useProfilePrefs, useSession } from '../hooks';
import { colors, fonts } from '../theme';
import { Chip } from './ChipBar';
import { ErrorText } from './Feedback';
import { FocusButton } from './FocusButton';
import { Icon } from './Icon';
import { focus } from './focus';

const SECTIONS: { section: CatalogSection; label: () => string }[] = [
  { section: 'movies', label: () => t('Movies') },
  { section: 'series', label: () => t('Series') },
  { section: 'live', label: () => t('Live TV') },
];

type Hidden = Partial<Record<CatalogSection, string[]>>;

/**
 * Account menu → Profiles → Categories shown (D-110): the categories this profile browses, per section. An unchecked
 * category leaves the category bars, lists, Home rows and the guide; search still finds its titles and channels. The
 * choice is applied when saved: it reloads every list.
 */
export function HiddenCategories({ onClose }: { onClose(): void }) {
  const profileId = useSession((s) => s.activeProfileId);
  const profileName = useSession((s) => selectActiveProfile(s)?.name ?? null);
  const saved = useProfilePrefs((s) => (profileId ? (s.prefs[profileId]?.hiddenCategories ?? {}) : {}));
  const [section, setSection] = useState<CatalogSection>('movies');
  const [lists, setLists] = useState<Partial<Record<CatalogSection, MediaCategory[]>>>({});
  const [hidden, setHidden] = useState<Hidden>(saved);
  const [error, setError] = useState<string | null>(null);
  const categories = lists[section];
  const hiddenHere = hidden[section] ?? [];

  useEffect(() => {
    if (lists[section]) return;
    api.catalog
      .categories(section, undefined, { includeHidden: true })
      .then((list) => setLists((current) => ({ ...current, [section]: list })))
      .catch(() => setError(t('The categories could not be loaded.')));
  }, [section, lists]);

  const toggle = (id: string) =>
    setHidden({ ...hidden, [section]: hiddenHere.includes(id) ? hiddenHere.filter((c) => c !== id) : [...hiddenHere, id] });
  const save = async () => {
    onClose();
    if (!profileId || JSON.stringify(hidden) === JSON.stringify(saved)) return;
    await stores.profilePrefs.getState().update(profileId, { hiddenCategories: hidden });
    // Rows and grids reload without the hidden categories.
    navStore.getState().bumpLibrary();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="hidden-categories">
          <Text style={styles.title}>{profileName ? t('Categories shown to {name}', { name: profileName }) : t('Categories shown')}</Text>
          <View style={styles.sections}>
            {SECTIONS.map((s) => (
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
              ListEmptyComponent={<Text style={styles.hint}>{t('No categories.')}</Text>}
              renderItem={({ item }) => (
                <CategoryRow name={item.name} checked={!hiddenHere.includes(item.id)} onPress={() => toggle(item.id)} />
              )}
            />
          ) : error ? null : (
            <ActivityIndicator color={colors.accent} />
          )}
          <View style={styles.actions}>
            <FocusButton label={t('Save')} variant="primary" onPress={() => void save()} testID="hidden-categories-save" />
            <FocusButton
              label={t('Show all')}
              variant="ghost"
              disabled={hiddenHere.length === 0}
              onPress={() => setHidden({ ...hidden, [section]: [] })}
              testID="hidden-categories-show-all"
            />
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
      testID={`hidden-category-${name}`}
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
