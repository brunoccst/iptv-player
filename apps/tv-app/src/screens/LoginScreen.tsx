import { useEffect, useState } from 'react';
import { fluid, type ConnectionMode } from '@iptv/shared';
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { stores } from '../appContext';
import { appConfig } from '../config';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { Gradient } from '../components/Gradient';
import { Chip } from './BrowseScreen';
import { connectionStore, useConnection, useSession } from '../hooks';
import { colors, fonts, radius, useSizes } from '../theme';

/**
 * Xtream login. "IPTV provider" (default) talks to the provider directly; "My server" goes through a backend (D-038).
 * Select a field to open the on-screen keyboard.
 */
export function LoginScreen() {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const savedMode = useConnection((s) => s.mode);
  const savedBackend = useConnection((s) => s.serverUrl);
  const [mode, setMode] = useState<ConnectionMode>(savedMode);
  const [backendUrl, setBackendUrl] = useState(savedBackend);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { width, height } = useWindowDimensions();
  // TV screens are only ~540 dp tall: tighter spacing so more of the form fits (the page still scrolls).
  const short = height < 600;
  const sizes = useSizes();

  useEffect(() => {
    void connectionStore.getState().load();
  }, []);
  useEffect(() => {
    setMode(savedMode);
    setBackendUrl(savedBackend);
  }, [savedMode, savedBackend]);

  const submit = async () => {
    await connectionStore.getState().setConnection(mode, backendUrl);
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
        <View
          style={[
            styles.panel,
            short && styles.panelShort,
            { width: Math.min(440, width - 32), paddingHorizontal: fluid(width, 20, 5, 60) },
          ]}
        >
          <Text style={[styles.heading, short && styles.headingShort]}>Sign In</Text>
          <View style={styles.modes} accessibilityRole="radiogroup">
            <Chip label="IPTV provider" active={mode === 'direct'} onPress={() => setMode('direct')} testID="login-mode-direct" />
            <Chip label="My server" active={mode === 'server'} onPress={() => setMode('server')} testID="login-mode-server" />
          </View>
          {mode === 'server' ? (
            <Field
              label="My server address"
              value={backendUrl}
              onChange={setBackendUrl}
              testID="login-backend"
              placeholder="http://192.168.1.10:5080"
            />
          ) : null}
          <Field
            label="Server URL"
            value={serverUrl}
            onChange={setServerUrl}
            testID="login-server"
            autoFocus
            placeholder="http://provider.example:8080"
          />
          <Field label="Username" value={username} onChange={setUsername} testID="login-username" />
          <Field label="Password" value={password} onChange={setPassword} testID="login-password" secure />
          {error ? <ErrorText>{errorText(error)}</ErrorText> : null}
          <FocusButton
            label={busy ? 'Signing in…' : 'Sign In'}
            variant="accent"
            onPress={() => void submit()}
            disabled={busy || (mode === 'server' && !backendUrl.trim())}
            testID="login-submit"
          />
          <Text style={styles.note}>
            {mode === 'direct'
              ? 'The app talks to your IPTV provider directly. Your password stays on this device, stored encrypted.'
              : 'Your IPTV password is sent once to your own backend, stored encrypted there, and never kept on this device.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  secure,
  testID,
  autoFocus,
  placeholder,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  secure?: boolean;
  testID: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        hasTVPreferredFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  brand: { position: 'absolute', top: 24, color: colors.accent, fontWeight: '900', letterSpacing: -0.5 },
  panel: { marginTop: 72, paddingVertical: 48, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: radius, gap: 16 },
  panelShort: { marginTop: 56, paddingVertical: 24, gap: 10 },
  heading: { color: colors.strong, fontSize: 32, fontWeight: '700', marginBottom: 8 },
  headingShort: { fontSize: 26, marginBottom: 0 },
  modes: { flexDirection: 'row', gap: 8 },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 14 },
  input: {
    minHeight: 48,
    backgroundColor: colors.input,
    color: colors.strong,
    fontSize: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.strong },
  note: { color: colors.muted, fontSize: 12.8 },
});
