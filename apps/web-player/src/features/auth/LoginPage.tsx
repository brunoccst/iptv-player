import { LoginScreen } from '@iptv/screens';
import '../browse/screenHost';

/**
 * Xtream login: the screen shared with the TV app (DECISIONS.md#d-199); the app talks to the provider directly (D-088,
 * D-071). The desktop app also offers sign-in by scanning a code with the phone app (D-060).
 */
export function LoginPage() {
  return <LoginScreen />;
}
