import { useEffect, useState } from 'react';
import type { ConnectionMode } from '@iptv/shared';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { stores } from '../appContext';
import { appConfig } from '../config';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { connectionStore, useConnection, useSession } from '../hooks';
import { colors, fonts, safe, spacing } from '../theme';

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
      <Text style={styles.brand}>{appConfig.appName}</Text>
      <View style={styles.panel}>
        <Text style={styles.heading}>Sign In</Text>
        <View style={styles.modes} accessibilityRole="radiogroup">
          <FocusButton
            label="IPTV provider"
            variant={mode === 'direct' ? 'primary' : 'secondary'}
            onPress={() => setMode('direct')}
            testID="login-mode-direct"
            accessibilityLabel={`Connect to the IPTV provider directly${mode === 'direct' ? ', selected' : ''}`}
          />
          <FocusButton
            label="My server"
            variant={mode === 'server' ? 'primary' : 'secondary'}
            onPress={() => setMode('server')}
            testID="login-mode-server"
            accessibilityLabel={`Connect through my server${mode === 'server' ? ', selected' : ''}`}
          />
        </View>
        {mode === 'server' ? (
          <Field
            label="Server address"
            value={backendUrl}
            onChange={setBackendUrl}
            testID="login-backend"
            placeholder="http://192.168.1.10:5080"
          />
        ) : null}
        <Field
          label="Provider URL"
          value={serverUrl}
          onChange={setServerUrl}
          testID="login-server"
          autoFocus
          placeholder="http://provider:8080"
        />
        <Field label="Username" value={username} onChange={setUsername} testID="login-username" />
        <Field label="Password" value={password} onChange={setPassword} testID="login-password" secure />
        {error ? <ErrorText>{errorText(error)}</ErrorText> : null}
        <FocusButton
          label={busy ? 'Signing in…' : 'Sign In'}
          variant="primary"
          onPress={() => void submit()}
          disabled={busy || (mode === 'server' && !backendUrl.trim())}
          testID="login-submit"
        />
      </View>
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
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  brand: {
    position: 'absolute',
    top: safe.vertical,
    left: safe.horizontal,
    color: colors.accent,
    fontSize: fonts.title,
    fontWeight: '900',
  },
  panel: { width: 420, padding: spacing.xl, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 4, gap: spacing.sm },
  heading: { color: colors.strong, fontSize: fonts.title, fontWeight: '700', marginBottom: spacing.sm },
  modes: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  field: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: fonts.small },
  input: {
    backgroundColor: '#333',
    color: colors.strong,
    fontSize: fonts.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputFocused: { borderColor: colors.strong },
});
