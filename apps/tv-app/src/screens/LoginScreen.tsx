import { useEffect, useRef, useState } from 'react';
import { fluid, type ConnectionMode } from '@iptv/shared';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { stores } from '../appContext';
import { appConfig } from '../config';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { Gradient } from '../components/Gradient';
import { BackupDialog } from '../components/BackupDialog';
import { Chip } from '../components/ChipBar';
import { Field } from '../components/Field';
import { connectionStore, useConnection, useSession } from '../hooks';
import { colors, radius, useSizes } from '../theme';

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
  const [restore, setRestore] = useState(false);
  const { width } = useWindowDimensions();
  // TV screens are only ~540 dp tall: two columns so every field fits. Uses the physical screen, not the window:
  // the on-screen keyboard shrinks the window, and switching layouts while typing made the keyboard flicker.
  const short = Dimensions.get('screen').height < 600;
  const sizes = useSizes();
  // Enter on the keyboard moves to the next field; on the password it signs in.
  const serverRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    void connectionStore.getState().load();
  }, []);
  useEffect(() => {
    setMode(savedMode);
    setBackendUrl(savedBackend);
  }, [savedMode, savedBackend]);

  const note = (
    <Text style={styles.note}>
      {mode === 'direct'
        ? 'The app talks to your IPTV provider directly. Your password stays on this device, stored encrypted.'
        : 'Your IPTV password is sent once to your own backend, stored encrypted there, and never kept on this device.'}
    </Text>
  );

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
        {/* Short landscape screens (TVs are ~540 dp tall): two columns so every field fits without scrolling. */}
        <View
          style={[
            styles.panel,
            short && styles.panelShort,
            {
              width: short ? Math.min(760, width - 32) : Math.min(440, width - 32),
              paddingHorizontal: short ? 32 : fluid(width, 20, 5, 60),
            },
          ]}
        >
          <View style={short ? styles.column : styles.stack}>
            <Text style={[styles.heading, short && styles.headingShort]}>Sign In</Text>
            <View style={styles.modes} accessibilityRole="radiogroup">
              <Chip label="IPTV provider" active={mode === 'direct'} onPress={() => setMode('direct')} testID="login-mode-direct" />
              <Chip label="My server" active={mode === 'server'} onPress={() => setMode('server')} testID="login-mode-server" />
            </View>
            {short ? note : null}
          </View>
          <View style={short ? styles.column : styles.stack}>
            {mode === 'server' ? (
              <Field
                label="My server address"
                value={backendUrl}
                onChange={setBackendUrl}
                testID="login-backend"
                placeholder="http://192.168.1.10:5080"
                compact={short}
                returnKeyType="next"
                onSubmit={() => serverRef.current?.focus()}
              />
            ) : null}
            <Field
              label="Server URL"
              value={serverUrl}
              onChange={setServerUrl}
              testID="login-server"
              autoFocus
              placeholder="http://provider.example:8080"
              compact={short}
              inputRef={serverRef}
              returnKeyType="next"
              onSubmit={() => usernameRef.current?.focus()}
            />
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              testID="login-username"
              compact={short}
              inputRef={usernameRef}
              returnKeyType="next"
              onSubmit={() => passwordRef.current?.focus()}
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              testID="login-password"
              secure
              compact={short}
              inputRef={passwordRef}
              returnKeyType="go"
              onSubmit={() => {
                if (!busy && !(mode === 'server' && !backendUrl.trim())) void submit();
              }}
            />
            {error ? <ErrorText>{errorText(error)}</ErrorText> : null}
            <FocusButton
              label={busy ? 'Signing in…' : 'Sign In'}
              variant="accent"
              onPress={() => void submit()}
              disabled={busy || (mode === 'server' && !backendUrl.trim())}
              testID="login-submit"
            />
            <FocusButton label="Restore from backup" variant="ghost" onPress={() => setRestore(true)} testID="login-restore" />
            {short ? null : note}
          </View>
        </View>
      </ScrollView>
      {restore ? <BackupDialog mode="restore" onClose={() => setRestore(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  brand: { position: 'absolute', top: 24, color: colors.accent, fontWeight: '900', letterSpacing: -0.5 },
  panel: { marginTop: 72, paddingVertical: 48, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: radius, gap: 16 },
  panelShort: { marginTop: 48, paddingVertical: 24, flexDirection: 'row', gap: 32 },
  stack: { gap: 16 },
  column: { flex: 1, gap: 10 },
  heading: { color: colors.strong, fontSize: 32, fontWeight: '700', marginBottom: 8 },
  headingShort: { fontSize: 26, marginBottom: 0 },
  modes: { flexDirection: 'row', gap: 8 },
  note: { color: colors.muted, fontSize: 12.8 },
});
