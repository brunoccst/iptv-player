import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORY_SECTIONS, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Chip } from './ui/ChipBar';
import { CheckRow } from './ui/CheckRow';
import { Dialog } from './ui/Dialog';
import { ErrorText } from './ui/Feedback';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts } from './ui/theme';

/**
 * Profile editor → Choose categories (D-053): the categories a Kids profile may see, per section. Starts from the
 * automatic choice (category names, D-053); "Automatic" goes back to it. Saved on this device with the profile.
 */
export function KidsCategories({ profileId, name, onClose }: { profileId: string; name: string; onClose(): void }) {
  const { section, setSection, categories, error, chosen, isPicked, toggle, automatic, save } = useScreenHost().hooks.useKidsCategories(
    profileId,
    onClose,
  );

  return (
    <Dialog title={t('Categories for {name}', { name })} onClose={onClose} testID="kids-categories" width={520}>
      <FocusRow style={styles.sections}>
        {CATEGORY_SECTIONS.map((s) => (
          <Chip
            key={s.section}
            label={s.label()}
            active={section === s.section}
            onPress={() => setSection(s.section)}
            testID={`kids-section-${s.section}`}
          />
        ))}
      </FocusRow>
      <Text style={styles.hint}>
        {chosen ? t('Chosen by you.') : t('Automatic: categories whose names say they are for kids.')}{' '}
        {t('Only checked categories are shown.')}
      </Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {categories ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {categories.length === 0 ? <Text style={styles.hint}>{t('No categories.')}</Text> : null}
          {categories.map((category) => (
            <CheckRow
              key={category.id}
              label={category.name}
              checked={isPicked(category.id)}
              onPress={() => toggle(category.id)}
              testID={`kids-category-${category.name}`}
            />
          ))}
        </ScrollView>
      ) : error ? null : (
        <ActivityIndicator color={colors.accent} />
      )}
      <FocusRow style={styles.actions}>
        <FocusButton label={t('Save')} variant="primary" onPress={() => void save()} testID="kids-categories-save" />
        <FocusButton label={t('Automatic')} variant="ghost" disabled={!chosen} onPress={automatic} testID="kids-categories-automatic" />
        <FocusButton label={t('Cancel')} variant="ghost" onPress={onClose} />
      </FocusRow>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.muted, fontSize: fonts.small },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
