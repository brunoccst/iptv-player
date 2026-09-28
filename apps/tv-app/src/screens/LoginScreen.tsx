import { useRef, useState } from 'react';
import { fluid, t, useUiLanguage } from '@iptv/shared';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { stores } from '../appContext';
import { appConfig } from '../config';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { Select } from '../components/Select';
import { chooseUiLanguage, uiLanguageOptions } from '../components/AppLanguageDialog';
import { Gradient } from '../components/Gradient';
import { BackupDialog } from '../components/BackupDialog';
import { Field } from '../components/Field';
import { useSession } from '../hooks';
import { usePairingServer } from '../pairing/pairing';
import { PairingCode } from '../pairing/PairingDialogs';
import { colors, fonts, radius, useSizes } from '../theme';

/** Xtream login: the app talks to the provider directly (D-038, D-088). Select a field to open the on-screen keyboard. */
export function LoginScreen() {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [restore, setRestore] = useState(false);
  const language = useUiLanguage();
  const { width } = useWindowDimensions();
  // TV screens are only ~540 dp tall: two columns so every field fits. Uses the physical screen, not the window:
  // the on-screen keyboard shrinks the window, and switching layouts while typing made the keyboard flicker.
  const short = Dimensions.get('screen').height < 600;
  const sizes = useSizes();
  // TVs also offer sign-in by scanning a code with the phone app (D-060); phones are the ones that scan.
  const phoneCard = Platform.isTV;
  // Enter on the keyboard moves to the next field; on the password it signs in.
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const available = width - 32 - (phoneCard ? PHONE_CARD_WIDTH + 16 : 0);

  const note = (
    <Text style={styles.note}>
      {t('The app talks to your IPTV provider directly. Your password stays on this device, stored encrypted.')}
    </Text>
  );

  const submit = async () => {
    await stores.session.getState().login({ serverUrl: serverUrl.trim(), username: username.trim(), password });
  };

  return (
    <View style={styles.screen}>
      <Gradient
        stops={[
          { offset: 0, color: colors.accent, opacity: 0.25 },
          { offset: 0.6, color: colors.accent, opacity: 0 },
        ]}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { left: sizes.gutter, fontSize: fluid(width, 26, 3, 38) }]}>{appConfig.appName}</Text>
        {/* Short landscape screens (TVs are ~540 dp tall): two columns so every field fits without scrolling. */}
        <View style={[styles.cards, { marginTop: short ? 48 : 72 }]}>
          <View
            style={[
              styles.panel,
              short && styles.panelShort,
              {
                width: short ? Math.min(760, available) : Math.min(440, available),
                paddingHorizontal: short ? 32 : fluid(width, 20, 5, 60),
              },
            ]}
          >
            <View style={short ? styles.column : styles.stack}>
              <Text style={[styles.heading, short && styles.headingShort]}>{t('Sign In')}</Text>
              {/* The app's language (D-084), before anything else is typed: choosing it draws the page again. */}
              <Select
                compact
                label={t('App language')}
                value={language}
                options={uiLanguageOptions()}
                onChange={chooseUiLanguage}
                testID="login-language"
              />
              {short ? note : null}
            </View>
            <View style={short ? styles.column : styles.stack}>
              <Field
                label={t('Server URL')}
                value={serverUrl}
                onChange={setServerUrl}
                testID="login-server"
                autoFocus
                placeholder="http://provider.example:8080"
                compact={short}
                returnKeyType="next"
                onSubmit={() => usernameRef.current?.focus()}
              />
              <Field
                label={t('Username')}
                value={username}
                onChange={setUsername}
                testID="login-username"
                compact={short}
                inputRef={usernameRef}
                returnKeyType="next"
                onSubmit={() => passwordRef.current?.focus()}
              />
              <Field
                label={t('Password')}
                value={password}
                onChange={setPassword}
                testID="login-password"
                secure
                compact={short}
                inputRef={passwordRef}
                returnKeyType="go"
                onSubmit={() => {
                  if (!busy) void submit();
                }}
              />
              {error ? <ErrorText>{errorText(error)}</ErrorText> : null}
              <FocusButton
                label={busy ? t('Signing in…') : t('Sign In')}
                variant="accent"
                onPress={() => void submit()}
                disabled={busy}
                testID="login-submit"
              />
              <FocusButton label={t('Restore from backup')} variant="ghost" onPress={() => setRestore(true)} testID="login-restore" />
              {short ? null : note}
            </View>
          </View>
          {phoneCard ? <PhoneSignIn /> : null}
        </View>
      </ScrollView>
      {restore ? <BackupDialog mode="restore" onClose={() => setRestore(false)} /> : null}
    </View>
  );
}

const PHONE_CARD_WIDTH = 230;

/** Sign in by scanning this code with the phone app (account menu → Connect a TV or computer), D-060. */
function PhoneSignIn() {
  const state = usePairingServer();
  return (
    <View style={styles.phoneCard} testID="login-phone">
      <Text style={styles.phoneTitle}>{t('Sign in with your phone')}</Text>
      <PairingCode state={state} size={170} />
      <Text style={styles.note}>{t('In the app on your phone: account menu → Connect a TV or computer, then scan this code.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  brand: { position: 'absolute', top: 24, color: colors.accent, fontWeight: '900', letterSpacing: -0.5 },
  cards: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  panel: { paddingVertical: 48, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: radius, gap: 16 },
  panelShort: { paddingVertical: 24, flexDirection: 'row', gap: 32 },
  phoneCard: {
    width: PHONE_CARD_WIDTH,
    padding: 20,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radius,
  },
  phoneTitle: { color: colors.strong, fontSize: fonts.body, fontWeight: '700', textAlign: 'center' },
  stack: { gap: 16 },
  column: { flex: 1, gap: 10 },
  heading: { color: colors.strong, fontSize: 32, fontWeight: '700', marginBottom: 8 },
  headingShort: { fontSize: 26, marginBottom: 0 },
  note: { color: colors.muted, fontSize: 12.8 },
});
