import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ApiError } from '@iptv/shared';
import { colors, fonts, spacing } from '../theme';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

/** User-facing text for ApiError codes (same wording as the web app). */
export function errorText(error: ApiError | null | undefined): string {
  if (!error) return '';
  switch (error.code) {
    case 'invalid_provider_credentials':
      return 'Your IPTV provider rejected this username or password.';
    case 'provider_credentials_rejected':
      return 'Your IPTV provider no longer accepts the saved login. Sign out and sign in again.';
    case 'provider_unavailable':
      // The detail (network error, timeout, HTTP status, bad reply) is the only clue when the app talks to the provider directly.
      return `Your IPTV provider is not responding. Try again in a moment.${error.message ? `\nDetails: ${error.message}` : ''}`;
    case 'network_error':
    case 'timeout':
      return 'Cannot reach the server. Check the backend address and that it is running.';
    default:
      return error.message || 'Something went wrong.';
  }
}

export function ErrorText({ children }: { children: string }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  error: { color: colors.warning, fontSize: fonts.body, marginVertical: spacing.sm },
});
