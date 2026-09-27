import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, UI_LANGUAGES, useUiLanguage, type UiLanguage } from '@iptv/shared';
import { appContext } from '../appContext';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';

/** The language names, each in its own language, for the choice (D-084). */
export const uiLanguageOptions = () => UI_LANGUAGES.map((language) => ({ value: language.id, label: language.name }));

/** Picks the app's language; the whole app redraws in it. Kept for the open profile and as this device's default. */
export const chooseUiLanguage = (language: string) => void appContext.uiLanguage.choose(language as UiLanguage);

/**
 * Account menu → App → App language (D-084): the language of the app's own words. Titles and categories keep the
 * provider's names. The menu item also says "App language" in English, so it can be found in a language one cannot read.
 */
export function AppLanguageDialog({ onClose }: { onClose(): void }) {
  const current = useUiLanguage();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="app-language">
          <Text style={styles.title}>{t('App language')}</Text>
          <Text style={styles.text}>{t('Titles and categories keep the names your provider gives them.')}</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {uiLanguageOptions().map((option) => (
              <FocusButton
                key={option.value}
                label={`${option.value === current ? '✓ ' : ''}${option.label}`}
                variant={option.value === current ? 'primary' : 'ghost'}
                hasTVPreferredFocus={option.value === current}
                testID={`app-language-${option.value}`}
                onPress={() => {
                  onClose();
                  chooseUiLanguage(option.value);
                }}
              />
            ))}
          </ScrollView>
          <FocusButton label={t('Close')} variant="ghost" onPress={onClose} testID="app-language-close" />
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
