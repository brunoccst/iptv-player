import { Alert, BackHandler } from 'react-native';
import { t } from '@iptv/shared';
import { signOut } from './appContext';
import { TvMedia } from '../modules/tv-media';

/** Asks first: signing out needs the provider password again and removes this account's downloads (D-050). */
export function confirmSignOut() {
  Alert.alert(t('Sign out?'), t('You will need your provider login to sign in again. Downloads on this device are deleted.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Sign out'), style: 'destructive', onPress: () => void signOut() },
  ]);
}

/** Asks first, then closes the app like "Force stop" in the system settings: the next start is a fresh one. */
export function confirmCloseApp() {
  Alert.alert(t('Close the app?'), t('The app closes completely, like "Force stop" in the settings. Downloads in progress stop.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Close the app'), style: 'destructive', onPress: () => void TvMedia.closeApp().catch(() => BackHandler.exitApp()) },
  ]);
}
