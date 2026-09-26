import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRef } from 'react';
import { LANGUAGE_NAMES, profileLanguages, selectActiveProfile } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { useProfilePrefs, useSession } from '../hooks';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';

/**
 * Account menu → Languages (D-063, D-067): only titles with audio or subtitles in one of the chosen languages, for the
 * active profile. Languages come from the names ("EN - …", "SUB ITA"); titles without any language tag are hidden
 * while a filter is on. Select toggles a language; "All languages" clears the choice.
 */
export function LanguageSettings({ onClose }: { onClose(): void }) {
  const profileId = useSession((s) => s.activeProfileId);
  const profileName = useSession((s) => selectActiveProfile(s)?.name ?? null);
  const chosen = useProfilePrefs((s) => (profileId ? profileLanguages(s.prefs[profileId]) : []));
  const changed = useRef(false);
  const save = async (languages: string[]) => {
    if (!profileId) return;
    changed.current = true;
    await stores.profilePrefs.getState().update(profileId, { languages, language: null });
  };
  const toggle = (code: string) => save(chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code]);
  const close = () => {
    // Rows and grids reload with the new filter.
    if (changed.current) navStore.getState().bumpLibrary();
    onClose();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="language-settings">
          <Text style={styles.title}>{profileName ? `Languages for ${profileName}` : 'Languages'}</Text>
          <Text style={styles.text}>
            Show only titles with audio or subtitles in one of these languages, as the provider names them. Each profile has its own choice.
          </Text>
          <ScrollView contentContainerStyle={styles.list}>
            <FocusButton
              label={`${chosen.length === 0 ? '✓ ' : ''}All languages`}
              variant={chosen.length === 0 ? 'primary' : 'ghost'}
              hasTVPreferredFocus={chosen.length === 0}
              testID="language-all"
              onPress={() => void save([])}
            />
            {Object.entries(LANGUAGE_NAMES).map(([code, label]) => {
              const on = chosen.includes(code);
              return (
                <FocusButton
                  key={code}
                  label={`${on ? '✓ ' : ''}${label}`}
                  variant={on ? 'primary' : 'ghost'}
                  hasTVPreferredFocus={on && code === chosen[0]}
                  testID={`language-${code}`}
                  onPress={() => void toggle(code)}
                />
              );
            })}
          </ScrollView>
          <FocusButton label="Done" variant="ghost" onPress={close} testID="language-close" />
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
