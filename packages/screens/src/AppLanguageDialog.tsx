import { ScrollView, StyleSheet, Text } from 'react-native';
import { t, UI_LANGUAGES, useUiLanguage } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { DialogActions } from './ui/DialogActions';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → App → App language (D-084): the language of the app's own words. Titles and categories keep the
 * provider's names. The menu item also says "App language" in English, so it can be found in a language one cannot read.
 */
export function AppLanguageDialog({ onClose }: { onClose(): void }) {
  const { signIn } = useScreenHost();
  const current = useUiLanguage();
  return (
    <Dialog
      title={t('App language')}
      onClose={onClose}
      testID="app-language"
      width={440}
      // Picking a language applies it and closes (DECISIONS.md#d-232): only Cancel, where every dialog has it.
      actions={<DialogActions onCancel={onClose} cancelTestID="app-language-close" />}
    >
      <Text style={styles.text}>{t('Titles and categories keep the names your provider gives them.')}</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {UI_LANGUAGES.map((language) => (
          <FocusButton
            key={language.id}
            label={`${language.id === current ? '✓ ' : ''}${language.name}`}
            variant={language.id === current ? 'primary' : 'ghost'}
            hasTVPreferredFocus={language.id === current}
            testID={`app-language-${language.id}`}
            onPress={() => {
              onClose();
              signIn.chooseLanguage(language.id);
            }}
          />
        ))}
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: fonts.small },
  list: { gap: 6 },
});
