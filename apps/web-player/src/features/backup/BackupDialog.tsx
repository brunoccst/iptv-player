import { useState } from 'react';
import { BACKUP_FILE_EXTENSION, BackupFailure, backupMessage, exportUserData, importUserData, MIN_BACKUP_PASSWORD } from '@iptv/shared';
import { appConfig } from '../../config';
import { storage } from '../../appContext';
import { Modal } from '../../components/Modal';

const failureText = (error: unknown) =>
  error instanceof BackupFailure ? backupMessage(error.reason) : 'Something went wrong. Please try again.';

/** Account menu → Back up & restore, and the login page's restore link (D-056). The file is encrypted with a password. */
export function BackupDialog({ restoreOnly = false, onClose }: { restoreOnly?: boolean; onClose(): void }) {
  return (
    <Modal label="Back up and restore" onClose={onClose}>
      <div className="profile-editor">
        {restoreOnly ? null : <BackupForm />}
        <RestoreForm />
      </div>
    </Modal>
  );
}

function BackupForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = async () => {
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      const text = await exportUserData({ secure: storage }, password);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      link.download = `${appConfig.appSlug}-backup-${new Date().toISOString().slice(0, 10)}${BACKUP_FILE_EXTENSION}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      setDone(true);
    } catch (e) {
      setError(failureText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Back up"
      style={{ display: 'grid', gap: 12 }}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setDone(false);
        void save();
      }}
    >
      <h2 style={{ margin: 0 }}>Back up</h2>
      <p className="muted" style={{ margin: 0 }}>
        Saves your sign-in, profiles, parental PIN, watch progress and My List to a file encrypted with a password. Keep the file private;
        the password is needed to restore it.
      </p>
      <PasswordField
        id="backup-password"
        label={`Password (at least ${MIN_BACKUP_PASSWORD} characters)`}
        value={password}
        onChange={setPassword}
      />
      <PasswordField id="backup-confirm" label="Repeat the password" value={confirm} onChange={setConfirm} />
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {done ? <p role="status">Backup saved to your downloads.</p> : null}
      <button type="submit" className="button button--primary" disabled={busy}>
        {busy ? 'Encrypting…' : 'Save backup file'}
      </button>
    </form>
  );
}

function RestoreForm() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    if (!file) return setError('Choose a backup file first.');
    setBusy(true);
    try {
      await importUserData({ secure: storage }, await file.text(), password);
      // Start over with the restored data, like opening the app on a new device.
      window.location.reload();
    } catch (e) {
      setError(failureText(e));
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Restore"
      style={{ display: 'grid', gap: 12 }}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        void restore();
      }}
    >
      <h2 style={{ margin: 0 }}>Restore</h2>
      <p className="muted" style={{ margin: 0 }}>
        Replaces the sign-in and settings in this browser with the ones in the file.
      </p>
      <div className="field">
        <label htmlFor="restore-file">Backup file</label>
        <input
          id="restore-file"
          className="input"
          type="file"
          accept={`${BACKUP_FILE_EXTENSION},application/json`}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <PasswordField id="restore-password" label="Backup password" value={password} onChange={setPassword} />
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="button button--primary" disabled={busy}>
        {busy ? 'Restoring…' : 'Restore backup'}
      </button>
    </form>
  );
}

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange(value: string): void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="password"
        autoComplete="new-password"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
