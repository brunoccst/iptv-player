import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { subtitleLanguageNames, t, type SubtitleSettings as Settings } from '@iptv/shared';
import { appContext } from '../appContext';
import { colors, fonts } from '../theme';
import { Field } from './Field';
import { FocusButton } from './FocusButton';

/**
 * Account menu → App → Automatic subtitles (D-111, issue #103): OpenSubtitles.com downloads a subtitle when a movie or
 * episode starts and none of its own is in a preferred language. Needs the user's API key; an account is optional (more
 * downloads per day). Languages are tried in the order they were picked. Saved on this device.
 */
export function SubtitleSettings({ onClose }: { onClose(): void }) {
  const [draft, setDraft] = useState<Settings>(appContext.subtitles.settings.getState().settings);
  const set = (patch: Partial<Settings>) => setDraft((current) => ({ ...current, ...patch }));
  const toggleLanguage = (code: string) =>
    set({ languages: draft.languages.includes(code) ? draft.languages.filter((c) => c !== code) : [...draft.languages, code] });
  const save = async () => {
    await appContext.subtitles.settings.getState().save({ ...draft, apiKey: draft.apiKey.trim(), username: draft.username.trim() });
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="subtitle-settings">
          <Text style={styles.title}>{t('Automatic subtitles')}</Text>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.text}>
              {t(
                'When a movie or episode starts without subtitles in one of your languages, one is downloaded from OpenSubtitles.com and turned on. It needs an API key (free at opensubtitles.com, under API consumers). Without an OpenSubtitles account, 5 subtitles a day can be downloaded.',
              )}
            </Text>
            <FocusButton
              label={draft.enabled ? t('On') : t('Off')}
              variant={draft.enabled ? 'primary' : 'ghost'}
              hasTVPreferredFocus
              testID="subtitle-settings-enabled"
              onPress={() => set({ enabled: !draft.enabled })}
            />
            <Field
              label={t('API key')}
              value={draft.apiKey}
              onChange={(apiKey) => set({ apiKey })}
              testID="subtitle-settings-key"
              compact
            />
            <Field
              label={t('OpenSubtitles username (optional)')}
              value={draft.username}
              onChange={(username) => set({ username })}
              testID="subtitle-settings-username"
              compact
            />
            <Field
              label={t('OpenSubtitles password (optional)')}
              value={draft.password}
              onChange={(password) => set({ password })}
              testID="subtitle-settings-password"
              secure
              compact
            />
            <Text style={styles.text}>{t('Languages, in order of preference:')}</Text>
            <View style={styles.languages}>
              {Object.entries(subtitleLanguageNames()).map(([code, name]) => {
                const rank = draft.languages.indexOf(code);
                return (
                  <FocusButton
                    key={code}
                    label={rank >= 0 ? `${rank + 1}. ${name}` : name}
                    variant={rank >= 0 ? 'primary' : 'ghost'}
                    testID={`subtitle-language-${code}`}
                    onPress={() => toggleLanguage(code)}
                  />
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <FocusButton label={t('Save')} variant="primary" onPress={() => void save()} testID="subtitle-settings-save" />
            <FocusButton label={t('Cancel')} variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 640,
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
  body: { gap: 12 },
  text: { color: colors.muted, fontSize: fonts.small },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
