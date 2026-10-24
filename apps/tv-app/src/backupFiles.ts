import { Directory, File } from 'expo-file-system';
import { appLog, BACKUP_FILE_EXTENSION, errorMessage, t } from '@iptv/shared';
import type { ScreenHost } from '@iptv/screens';
import { appContext, backupStorages, playbackSettings } from './appContext';
import { appConfig } from './config';

/** The system pickers reject when the user backs out; that is not an error. */
const cancelled = (error: unknown) => /cancel/i.test(`${(error as { code?: string }).code ?? ''} ${errorMessage(error)}`);

/** Where the TV and phone keep backups (D-056, DECISIONS.md#d-216): a place the user picks (Downloads, USB stick, …). */
export const backupFiles: ScreenHost['backup'] = {
  storages: backupStorages,
  fileName: () => `${appConfig.appSlug}-backup-${new Date().toISOString().slice(0, 10)}${BACKUP_FILE_EXTENSION}`,
  contents: () =>
    t(
      'Saves your sign-in, server settings, profiles, parental PIN, watch progress, My List and playback settings to a file encrypted with a password. Restore it after reinstalling the app or on another device.',
    ),
  async save(name, text) {
    try {
      const folder = await Directory.pickDirectoryAsync();
      folder.createFile(name, 'application/octet-stream').write(text);
      return t('Saved {name}. Keep it private; the password is needed to restore it.', { name });
    } catch (error) {
      if (cancelled(error)) return null;
      throw error;
    }
  },
  async pick() {
    try {
      const picked = await File.pickFileAsync();
      return picked.canceled ? null : picked.result;
    } catch (error) {
      if (cancelled(error)) return null;
      throw error;
    }
  },
  restored: async () => {
    await Promise.all([appContext.reload(), playbackSettings.getState().load()]);
  },
  failure(error) {
    appLog.warn('backup', errorMessage(error));
    return t('The file could not be read or saved. On a TV, a file manager app may be needed to pick folders and files.');
  },
};
