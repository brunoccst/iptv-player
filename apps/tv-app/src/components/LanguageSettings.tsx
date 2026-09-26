import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_NAMES } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { useProfilePrefs, useSession } from '../hooks';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';

const CHOICES: { code: string | null; label: string }[] = [
  { code: null, label: 'All languages' },
  ...Object.entries(LANGUAGE_NAMES).map(([code, label]) => ({ code, label })),
];

/**
 * Account menu → Language (D-063): only titles with audio or subtitles in the chosen language, for the active profile.
 * Languages come from the names ("EN - …", "SUB ITA"); titles without any language tag are hidden while a filter is on.
 */
export function LanguageSettings({ onClose }: { onClose(): void }) {
  const profileId = useSession((s) => s.activeProfileId);
  const current = useProfilePrefs((s) => (profileId ? (s.prefs[profileId]?.language ?? null) : null));
  const choose = async (code: string | null) => {
    if (!profileId) return;
    await stores.profilePrefs.getState().update(profileId, { language: code });
    // Rows and grids reload with the new filter.
    navStore.getState().bumpLibrary();
    onClose();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="language-settings">
          <Text style={styles.title}>Language</Text>
          <Text style={styles.text}>
            Show only titles with audio or subtitles in this language, as the provider names them. Applies to this profile.
          </Text>
          <ScrollView contentContainerStyle={styles.list}>
            {CHOICES.map(({ code, label }) => (
              <FocusButton
                key={code ?? 'all'}
                label={`${current === code ? '✓ ' : ''}${label}`}
                variant={current === code ? 'primary' : 'ghost'}
                hasTVPreferredFocus={current === code}
                testID={`language-${code ?? 'all'}`}
                onPress={() => void choose(code)}
              />
            ))}
          </ScrollView>
          <FocusButton label="Close" variant="ghost" onPress={onClose} testID="language-close" />
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
