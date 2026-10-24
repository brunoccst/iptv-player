import { BACKUP_FILE_EXTENSION, t } from '@iptv/shared';
import type { ScreenHost } from '@iptv/screens';
import { backupStorages } from '../../appContext';
import { appConfig } from '../../config';

/** The desktop's backups (D-056, DECISIONS.md#d-216): saved as a download, restored from a file the user picks. */
export const backupFiles: ScreenHost['backup'] = {
  storages: backupStorages,
  fileName: () => `${appConfig.appSlug}-backup-${new Date().toISOString().slice(0, 10)}${BACKUP_FILE_EXTENSION}`,
  contents: () =>
    t(
      'Saves your sign-in, profiles, parental PIN, watch progress and My List to a file encrypted with a password. Keep the file private; the password is needed to restore it.',
    ),
  async save(name, text) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    return t('Backup saved to your downloads.');
  },
  pick: () =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = `${BACKUP_FILE_EXTENSION},application/json`;
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    }),
  // Start over with the restored data, like opening the app on a new device.
  restored: async () => window.location.reload(),
  failure: () => t('Something went wrong. Please try again.'),
};
