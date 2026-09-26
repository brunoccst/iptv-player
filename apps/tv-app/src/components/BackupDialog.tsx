import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Directory, File } from 'expo-file-system';
import {
  appLog,
  BACKUP_FILE_EXTENSION,
  BackupFailure,
  backupMessage,
  errorMessage,
  exportUserData,
  importUserData,
  MIN_BACKUP_PASSWORD,
} from '@iptv/shared';
import { appContext, backupStorages, playbackSettings } from '../appContext';
import { appConfig } from '../config';
import { colors, fonts } from '../theme';
import { ErrorText } from './Feedback';
import { Field } from './Field';
import { FocusButton } from './FocusButton';

/** The system pickers reject when the user backs out; that is not an error. */
const cancelled = (error: unknown) => /cancel/i.test(`${(error as { code?: string }).code ?? ''} ${errorMessage(error)}`);

const failureText = (error: unknown) => {
  if (error instanceof BackupFailure) return backupMessage(error.reason);
  appLog.warn('backup', errorMessage(error));
  return 'The file could not be read or saved. On a TV, a file manager app may be needed to pick folders and files.';
};

/**
 * Account menu → Back up data (`mode="backup"`), and Login → Restore from backup (`mode="restore"`); D-056.
 * The file is encrypted with a password and saved to / read from a place the user picks (Downloads, USB stick, …).
 */
export function BackupDialog({ mode, onClose }: { mode: 'backup' | 'restore'; onClose(): void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch (e) {
      if (!cancelled(e)) setError(failureText(e));
    } finally {
      setBusy(false);
    }
  };

  const backup = () =>
    run(async () => {
      if (password !== confirm) return;
      const text = await exportUserData(backupStorages, password);
      const folder = await Directory.pickDirectoryAsync();
      const name = `${appConfig.appSlug}-backup-${new Date().toISOString().slice(0, 10)}${BACKUP_FILE_EXTENSION}`;
      folder.createFile(name, 'application/octet-stream').write(text);
      setDone(`Saved ${name}. Keep it private; the password is needed to restore it.`);
    });

  const pick = () =>
    run(async () => {
      const picked = await File.pickFileAsync();
      if (!picked.canceled) setFile(picked.result);
    });

  const restore = () =>
    run(async () => {
      if (!file) return;
      await importUserData(backupStorages, await file.text(), password);
      await Promise.all([appContext.reload(), playbackSettings.getState().load()]);
      onClose();
    });

  const mismatch = mode === 'backup' && confirm.length > 0 && password !== confirm;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.panel} testID="backup-dialog">
            <Text style={styles.title}>{mode === 'backup' ? 'Back up data' : 'Restore from backup'}</Text>
            {done ? (
              <>
                <Text style={styles.text}>{done}</Text>
                <FocusButton label="Close" variant="primary" hasTVPreferredFocus onPress={onClose} />
              </>
            ) : mode === 'backup' ? (
              <>
                <Text style={styles.text}>
                  Saves your sign-in, server settings, profiles, parental PIN, watch progress, My List and playback settings to a file
                  encrypted with a password. Restore it after reinstalling the app or on another device.
                </Text>
                <Field
                  label={`Password (at least ${MIN_BACKUP_PASSWORD} characters)`}
                  value={password}
                  onChange={setPassword}
                  secure
                  autoFocus
                  testID="backup-password"
                />
                <Field label="Repeat the password" value={confirm} onChange={setConfirm} secure testID="backup-confirm" />
                {mismatch ? <ErrorText>The two passwords do not match.</ErrorText> : null}
                {error ? <ErrorText>{error}</ErrorText> : null}
                <FocusButton
                  label={busy ? 'Encrypting…' : 'Choose folder and save'}
                  variant="primary"
                  disabled={busy || mismatch || !confirm}
                  testID="backup-save"
                  onPress={() => void backup()}
                />
                <FocusButton label="Cancel" variant="ghost" onPress={onClose} />
              </>
            ) : (
              <>
                <Text style={styles.text}>Replaces the sign-in and settings on this device with the ones in the file.</Text>
                <FocusButton
                  label={file ? `File: ${file.name}` : 'Choose backup file'}
                  variant="ghost"
                  hasTVPreferredFocus
                  testID="restore-pick"
                  onPress={() => void pick()}
                />
                <Field label="Backup password" value={password} onChange={setPassword} secure testID="restore-password" />
                {error ? <ErrorText>{error}</ErrorText> : null}
                <FocusButton
                  label={busy ? 'Restoring…' : 'Restore'}
                  variant="primary"
                  disabled={busy || !file || !password}
                  testID="restore-submit"
                  onPress={() => void restore()}
                />
                <FocusButton label="Cancel" variant="ghost" onPress={onClose} />
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 420,
    maxWidth: '100%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  text: { color: colors.text, fontSize: fonts.small },
});
