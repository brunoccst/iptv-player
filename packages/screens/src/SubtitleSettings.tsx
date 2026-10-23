import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { subtitleLanguageNames, t, type SubtitleSettings as Settings } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { Field } from './ui/Field';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → App → Automatic subtitles (D-111, issue #103): OpenSubtitles.com downloads a subtitle when a movie or
 * episode starts and none of its own is in a preferred language. Needs the user's API key; an account is optional (more
 * downloads per day). Languages are tried in the order they were picked. Saved on this device.
 */
export function SubtitleSettings({ onClose }: { onClose(): void }) {
  const { subtitles } = useScreenHost();
  const [draft, setDraft] = useState<Settings>(subtitles.settings.getState().settings);
  const set = (patch: Partial<Settings>) => setDraft((current) => ({ ...current, ...patch }));
  const toggleLanguage = (code: string) =>
    set({ languages: draft.languages.includes(code) ? draft.languages.filter((c) => c !== code) : [...draft.languages, code] });
  const save = async () => {
    await subtitles.settings.getState().save({ ...draft, apiKey: draft.apiKey.trim(), username: draft.username.trim() });
    onClose();
  };

  return (
    <Dialog title={t('Automatic subtitles')} onClose={onClose} testID="subtitle-settings" width={640}>
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
        <Field label={t('API key')} value={draft.apiKey} onChange={(apiKey) => set({ apiKey })} testID="subtitle-settings-key" compact />
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
        <FocusRow style={styles.languages}>
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
        </FocusRow>
      </ScrollView>
      <FocusRow style={styles.actions}>
        <FocusButton label={t('Save')} variant="primary" onPress={() => void save()} testID="subtitle-settings-save" />
        <FocusButton label={t('Cancel')} variant="ghost" onPress={onClose} />
      </FocusRow>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  text: { color: colors.muted, fontSize: fonts.small },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
