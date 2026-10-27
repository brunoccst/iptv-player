import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { DialogActions } from './ui/DialogActions';
import { ErrorText, errorText } from './ui/Feedback';
import { Field } from './ui/Field';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts } from './ui/theme';

/**
 * Account menu → IPTV account (DECISIONS.md#d-228): the provider's server, username and password, changed without
 * signing out. The password stays hidden until Show. Save checks the new details with the provider first; the
 * account's profiles, My List and progress stay.
 */
export function ProviderAccount({ onClose }: { onClose(): void }) {
  const { api, hooks, stores } = useScreenHost();
  const busy = hooks.useSession((s) => s.busy);
  const error = hooks.useSession((s) => s.error);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    stores.session.getState().clearError();
    let active = true;
    void api.auth
      .credentials()
      .then((saved) => {
        if (!active) return;
        setServerUrl(saved.serverUrl);
        setUsername(saved.username);
        setPassword(saved.password);
      })
      .catch(() => undefined)
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [api, stores]);

  const save = async () => {
    const saved = await stores.session
      .getState()
      .updateCredentials({ serverUrl: serverUrl.trim(), username: username.trim(), password, providerType: 'xtream' });
    if (!saved) return;
    // Lists and the guide come from the new address.
    stores.catalog.getState().reset();
    stores.epg.getState().reset();
    stores.library.getState().reset();
    onClose();
  };

  return (
    <Dialog
      title={t('IPTV account')}
      onClose={onClose}
      testID="provider-account"
      width={560}
      actions={
        <DialogActions
          onSave={() => void save()}
          onCancel={onClose}
          saveLabel={busy ? t('Checking…') : t('Save')}
          saveDisabled={busy || !loaded}
          saveTestID="provider-account-save"
          cancelTestID="provider-account-cancel"
        />
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.text}>
          {t('The details your IPTV provider gave you. Changes are checked with the provider before they are saved.')}
        </Text>
        <Field label={t('Server URL')} value={serverUrl} onChange={setServerUrl} testID="provider-account-server" autoFocus compact />
        <Field label={t('Username')} value={username} onChange={setUsername} testID="provider-account-username" compact />
        <FocusRow style={styles.password}>
          <View style={styles.passwordField}>
            <Field
              label={t('Password')}
              value={password}
              onChange={setPassword}
              secure={!reveal}
              testID="provider-account-password"
              compact
            />
          </View>
          <FocusButton
            label={reveal ? t('Hide') : t('Show')}
            icon={reveal ? 'eyeOff' : 'eye'}
            variant="ghost"
            testID="provider-account-reveal"
            onPress={() => setReveal((shown) => !shown)}
          />
        </FocusRow>
        {error ? <ErrorText>{errorText(error)}</ErrorText> : null}
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  text: { color: colors.muted, fontSize: fonts.small },
  password: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  passwordField: { flex: 1 },
});
