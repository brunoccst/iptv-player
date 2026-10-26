import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackupFailure, backupMessage, exportUserData, importUserData, MIN_BACKUP_PASSWORD, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { DialogActions } from './ui/DialogActions';
import { ErrorText } from './ui/Feedback';
import { Field } from './ui/Field';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

type Mode = 'backup' | 'restore' | 'both';

const TITLES: Record<Mode, () => string> = {
  backup: () => t('Back up data'),
  restore: () => t('Restore from backup'),
  both: () => t('Back up and restore'),
};

/**
 * Backing up to a file encrypted with a password, and restoring it (D-056), the same on every app (issue #237,
 * DECISIONS.md#d-216). `backup`: the account menu on TV and phone; `restore`: the sign-in page; `both`: the desktop's
 * account menu, which can also restore. The app says where the file goes and comes from (`ScreenHost.backup`).
 */
export function BackupDialog({ mode, onClose }: { mode: Mode; onClose(): void }) {
  return (
    <Dialog title={TITLES[mode]()} onClose={onClose} testID="backup-dialog" width={mode === 'both' ? 480 : 420}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {mode === 'restore' ? null : <BackupSection heading={mode === 'both'} onClose={onClose} />}
        {mode === 'backup' ? null : <RestoreSection heading={mode === 'both'} onClose={onClose} />}
        {mode === 'both' ? <FocusButton label={t('Close')} variant="ghost" onPress={onClose} /> : null}
      </ScrollView>
    </Dialog>
  );
}

function useFailure() {
  const { backup } = useScreenHost();
  return (error: unknown) => (error instanceof BackupFailure ? backupMessage(error.reason) : backup.failure(error));
}

const statusRole = Platform.OS === 'web' ? { role: 'status' as const } : {};

function BackupSection({ heading, onClose }: { heading: boolean; onClose(): void }) {
  const { backup } = useScreenHost();
  const failure = useFailure();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const save = async () => {
    if (password !== confirm) return;
    setError(null);
    setBusy(true);
    try {
      const text = await exportUserData(backup.storages, password);
      setDone(await backup.save(backup.fileName(), text));
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  };

  const mismatch = confirm.length > 0 && password !== confirm;
  return (
    <View style={styles.section}>
      {heading ? (
        <Text style={styles.heading} accessibilityRole="header">
          {t('Back up')}
        </Text>
      ) : null}
      {done ? (
        <>
          <Text style={styles.text} {...statusRole}>
            {done}
          </Text>
          {heading ? null : <FocusButton label={t('Close')} variant="primary" hasTVPreferredFocus onPress={onClose} />}
        </>
      ) : (
        <>
          <Text style={styles.text}>{backup.contents()}</Text>
          <Field
            label={t('Password (at least {count} characters)', { count: MIN_BACKUP_PASSWORD })}
            value={password}
            onChange={setPassword}
            secure
            autoFocus
            testID="backup-password"
          />
          <Field label={t('Repeat the password')} value={confirm} onChange={setConfirm} secure testID="backup-confirm" />
          {mismatch ? <ErrorText>{t('The two passwords do not match.')}</ErrorText> : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <DialogActions
            onSave={() => void save()}
            onCancel={heading ? undefined : onClose}
            saveLabel={busy ? t('Encrypting…') : t('Save backup file')}
            saveDisabled={busy || mismatch || !confirm}
            saveTestID="backup-save"
          />
        </>
      )}
    </View>
  );
}

function RestoreSection({ heading, onClose }: { heading: boolean; onClose(): void }) {
  const { backup } = useScreenHost();
  const failure = useFailure();
  const [file, setFile] = useState<{ name: string; text(): Promise<string> } | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = () =>
    run(async () => {
      const picked = await backup.pick();
      if (picked) setFile(picked);
    });

  const restore = () =>
    run(async () => {
      if (!file) return;
      await importUserData(backup.storages, await file.text(), password);
      await backup.restored();
      onClose();
    });

  return (
    <View style={styles.section}>
      {heading ? (
        <Text style={styles.heading} accessibilityRole="header">
          {t('Restore')}
        </Text>
      ) : null}
      <Text style={styles.text}>{t('Replaces the sign-in and settings on this device with the ones in the file.')}</Text>
      <FocusButton
        label={file ? t('File: {name}', { name: file.name }) : t('Choose backup file')}
        variant="ghost"
        hasTVPreferredFocus={!heading}
        testID="restore-pick"
        onPress={() => void pick()}
      />
      <Field label={t('Backup password')} value={password} onChange={setPassword} secure testID="restore-password" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <DialogActions
        onSave={() => void restore()}
        onCancel={heading ? undefined : onClose}
        saveLabel={busy ? t('Restoring…') : t('Restore backup')}
        saveDisabled={busy || !file || !password}
        saveTestID="restore-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 24 },
  section: { gap: 12 },
  heading: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  text: { color: colors.text, fontSize: fonts.small },
});
