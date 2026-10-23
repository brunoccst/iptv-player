import { t } from '@iptv/shared';
import { downloadsStore, signOut } from '../appContext';

/** Signs out; asks first when there are downloads, which belong to this account and are deleted (D-050). */
export function confirmSignOut() {
  const hasDownloads = Object.keys(downloadsStore.getState().records).length > 0;
  if (hasDownloads && !window.confirm(t('Signing out deletes the downloads on this device. Sign out?'))) return;
  void signOut();
}
