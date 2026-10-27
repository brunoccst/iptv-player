import { ScrollView, StyleSheet, Text } from 'react-native';
import { languageNames, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { DialogActions } from './ui/DialogActions';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → Content language filter (D-063): only titles with audio or subtitles in one of the chosen languages, for the
 * active profile. The order they are ticked in is their priority (D-063). Languages come from the names ("EN - …", "SUB ITA"); titles without any language tag are hidden
 * while a filter is on. Select toggles a language; "All languages" clears the choice. The choice is applied once, on
 * Save: applying it reloads every list, so doing that on each toggle would stall the TV. Cancel or Back drops it
 * (DECISIONS.md#d-232).
 */
export function LanguageSettings({ onClose, profile }: { onClose(): void; profile?: { id: string; name: string } }) {
  // The active profile from the account menu; a given one from the profile editor (e.g. a Kids profile).
  const { title, chosen, toggle, allLanguages, save } = useScreenHost().hooks.useLanguageSettings(profile, onClose);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      testID="language-settings"
      width={440}
      tall
      actions={<DialogActions onSave={save} onCancel={onClose} saveTestID="language-save" cancelTestID="language-cancel" />}
    >
      <Text style={styles.text}>
        {t(
          'Show only titles in one of these languages: from the title\'s name ("EN - …", "SUB ITA"), else from its category\'s name. Titles in a category without a language are always shown. Each profile has its own choice.',
        )}
      </Text>
      <Text style={styles.text}>
        {t('The order you tick them in is their priority: a title starts with its version in the first of them that it has.')}
      </Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        <FocusButton
          label={`${chosen.length === 0 ? '✓ ' : ''}${t('All languages')}`}
          variant={chosen.length === 0 ? 'primary' : 'ghost'}
          hasTVPreferredFocus={chosen.length === 0}
          testID="language-all"
          onPress={() => allLanguages()}
        />
        {Object.entries(languageNames()).map(([code, label]) => {
          // The order the languages were ticked in is their priority (D-063): "✓ 1. English".
          const rank = chosen.indexOf(code);
          const on = rank >= 0;
          return (
            <FocusButton
              key={code}
              label={`${on ? `✓ ${rank + 1}. ` : ''}${label}`}
              variant={on ? 'primary' : 'ghost'}
              hasTVPreferredFocus={on && code === chosen[0]}
              testID={`language-${code}`}
              onPress={() => toggle(code)}
            />
          );
        })}
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: fonts.small },
  // Fills the room left in a tall dialog and scrolls there, so Save stays in view (DECISIONS.md#d-231).
  scroll: { flex: 1 },
  list: { gap: 6 },
});
