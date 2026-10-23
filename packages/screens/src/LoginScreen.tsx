import { useRef, useState } from 'react';
import { fluid, t, useUiLanguage, UI_LANGUAGES } from '@iptv/shared';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useScreenHost } from './host';
import { ErrorText, errorText } from './ui/Feedback';
import { Field } from './ui/Field';
import { FocusButton } from './ui/FocusButton';
import { Gradient } from './ui/Gradient';
import { Select } from './ui/Select';
import { colors, fonts, radius, useSizes } from './ui/theme';

/**
 * Xtream login (DECISIONS.md#d-199): the app talks to the provider directly (D-088). One screen for TV, phone and
 * desktop. On TV and phone, selecting a field opens the on-screen keyboard.
 */
export function LoginScreen() {
  const { hooks, stores, signIn } = useScreenHost();
  const { Restore, DeviceCode } = signIn;
  const busy = hooks.useSession((s) => s.busy);
  const error = hooks.useSession((s) => s.error);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [restore, setRestore] = useState(false);
  const language = useUiLanguage();
  const { width, height } = useWindowDimensions();
  // TV screens are only ~540 dp tall: two columns so every field fits. Uses the physical screen, not the window:
  // the on-screen keyboard shrinks the window, and switching layouts while typing made the keyboard flicker.
  const short = Dimensions.get('screen').height < 600;
  const sizes = useSizes();
  // Every device also offers sign-in from another device (D-060, D-178): beside the form when there is room
  // (TVs, wide tablets), below it otherwise.
  const side = width >= 760 && !!DeviceCode;
  // Enter on the keyboard moves to the next field; on the password it signs in.
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const available = width - 32 - (side ? PHONE_CARD_WIDTH + 16 : 0);

  const noteText = signIn.note();
  const note = noteText ? <Text style={styles.note}>{noteText}</Text> : null;

  const submit = async () => {
    await stores.session.getState().login({ serverUrl: serverUrl.trim(), username: username.trim(), password });
  };

  return (
    // Desktop: the page is as tall as the window, so the form sits in its middle.
    <View style={[styles.screen, Platform.OS === 'web' && { height }]}>
      <Gradient
        stops={[
          { offset: 0, color: colors.accent, opacity: 0.25 },
          { offset: 0.6, color: colors.accent, opacity: 0 },
        ]}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { left: sizes.gutter, fontSize: fluid(width, 26, 3, 38) }]}>{signIn.appName}</Text>
        {/* Short landscape screens (TVs are ~540 dp tall): two columns so every field fits without scrolling. */}
        <View style={[styles.cards, !side && styles.cardsStacked, { marginTop: short ? 48 : 72 }]}>
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
              <Text accessibilityRole="header" style={[styles.heading, short && styles.headingShort]}>
                {t('Sign In')}
              </Text>
              {/* The app's language (D-084), before anything else is typed: choosing it draws the page again. */}
              <Select
                compact
                label={t('App language')}
                value={language}
                options={UI_LANGUAGES.map((option) => ({ value: option.id, label: option.name }))}
                onChange={signIn.chooseLanguage}
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
              <FocusButton label={t('Restore from a backup')} variant="ghost" onPress={() => setRestore(true)} testID="login-restore" />
              {short ? null : note}
            </View>
          </View>
          {DeviceCode ? (
            <View style={[styles.phoneCard, { width: side ? PHONE_CARD_WIDTH : Math.min(440, available) }]} testID="login-phone">
              <Text accessibilityRole="header" style={styles.phoneTitle}>
                {t('Sign in with another device')}
              </Text>
              <DeviceCode />
              <Text style={styles.note}>
                {t('With the app on a signed-in phone or tablet: account menu → Sync with another device → Scan a code.')}
              </Text>
              {signIn.scan?.available() ? (
                <>
                  <Text style={styles.note}>{t('Signed in on another device? Scan its code to sign in here.')}</Text>
                  <FocusButton label={t('Scan a code')} variant="ghost" onPress={signIn.scan.open} testID="login-scan" />
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      {restore ? <Restore onClose={() => setRestore(false)} /> : null}
    </View>
  );
}

const PHONE_CARD_WIDTH = 230;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  brand: { position: 'absolute', top: 24, color: colors.accent, fontWeight: '900', letterSpacing: -0.5 },
  cards: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  cardsStacked: { flexDirection: 'column', alignItems: 'center' },
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
