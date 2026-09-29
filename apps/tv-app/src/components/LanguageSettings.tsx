import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { languageNames, t } from '@iptv/shared';

import { useLanguageSettings } from '../hooks';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';

/**
 * Account menu → Content language filter (D-063, D-067, D-086): only titles with audio or subtitles in one of the chosen languages, for the
 * active profile. Languages come from the names ("EN - …", "SUB ITA"); titles without any language tag are hidden
 * while a filter is on. Select toggles a language; "All languages" clears the choice. The choice is applied once, when
 * the dialog closes: applying it reloads every list, so doing that on each toggle would stall the TV.
 */
export function LanguageSettings({ onClose, profile }: { onClose(): void; profile?: { id: string; name: string } }) {
  // The active profile from the account menu; a given one from the profile editor (e.g. a Kids profile).
  const { title, chosen, toggle, allLanguages, close } = useLanguageSettings(profile, onClose);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="language-settings">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>
            {t(
              'Show only titles in one of these languages: from the title\'s name ("EN - …", "SUB ITA"), else from its category\'s name. Titles in a category without a language are always shown. Each profile has its own choice.',
            )}
          </Text>
          <ScrollView contentContainerStyle={styles.list}>
            <FocusButton
              label={`${chosen.length === 0 ? '✓ ' : ''}${t('All languages')}`}
              variant={chosen.length === 0 ? 'primary' : 'ghost'}
              hasTVPreferredFocus={chosen.length === 0}
              testID="language-all"
              onPress={() => allLanguages()}
            />
            {Object.entries(languageNames()).map(([code, label]) => {
              const on = chosen.includes(code);
              return (
                <FocusButton
                  key={code}
                  label={`${on ? '✓ ' : ''}${label}`}
                  variant={on ? 'primary' : 'ghost'}
                  hasTVPreferredFocus={on && code === chosen[0]}
                  testID={`language-${code}`}
                  onPress={() => toggle(code)}
                />
              );
            })}
          </ScrollView>
          <FocusButton label={t('Done')} variant="ghost" onPress={close} testID="language-close" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 440,
    maxWidth: '100%',
    maxHeight: '90%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  text: { color: colors.text, fontSize: fonts.small },
  list: { gap: 6 },
});
