import { useState, type FormEvent } from 'react';
import { t } from '@iptv/shared';
import { appConfig } from '../../config';
import { stores } from '../../appContext';
import { desktop } from '../../desktop';
import { AppLanguageSelect } from '../shell/AppLanguageDialog';
import { useSession } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { BackupDialog } from '../backup/BackupDialog';
import { canScanWithWebcam, usePairingServer } from '../pairing/pairing';
import { openSyncWithPhone, PairingCode } from '../pairing/SyncWithPhone';

/**
 * Xtream login, laid out like the TV app's: the app talks to the provider directly (D-088, D-071). The desktop
 * app also offers, next to the form, sign-in by scanning a code with the phone app (D-060).
 */
export function LoginPage() {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [restore, setRestore] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await stores.session.getState().login({ serverUrl: serverUrl.trim(), username: username.trim(), password });
  };

  return (
    <main className="login">
      <h1 className="login__brand">{appConfig.appName}</h1>
      <div className="login__cards">
        <form className="login__panel" onSubmit={(event) => void submit(event)} aria-label={t('Sign in')}>
          <h2>{t('Sign In')}</h2>
          <AppLanguageSelect id="login-language" />
          <div className="field">
            <label htmlFor="server-url">{t('Server URL')}</label>
            <input
              id="server-url"
              className="input"
              type="text"
              inputMode="url"
              placeholder="http://provider.example:8080"
              autoComplete="url"
              required
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="username">{t('Username')}</label>
            <input
              id="username"
              className="input"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t('Password')}</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="error-text" role="alert">
              {errorText(error)}
            </p>
          ) : null}
          <button type="submit" className="button button--accent" disabled={busy}>
            {busy ? t('Signing in…') : t('Sign In')}
          </button>
          <button type="button" className="button button--ghost" onClick={() => setRestore(true)}>
            {t('Restore from a backup')}
          </button>
          {desktop ? (
            <p className="muted login__note">
              {t('The app talks to your IPTV provider directly. Your password stays on this computer, encrypted by the system.')}
            </p>
          ) : null}
        </form>
        {desktop ? <PhoneSignIn /> : null}
      </div>
      {restore ? <BackupDialog restoreOnly onClose={() => setRestore(false)} /> : null}
    </main>
  );
}

/** Desktop app: sign in by scanning this code with the phone app, as on the TV (D-060). */
function PhoneSignIn() {
  const state = usePairingServer();
  return (
    <section className="login__phone" aria-label={t('Sign in with another device')} data-testid="login-phone">
      <h3>{t('Sign in with another device')}</h3>
      <PairingCode state={state} size={180} />
      <p className="muted login__note">
        {t('With the app on a signed-in phone or tablet: account menu → Sync with another device → Scan a code.')}
      </p>
      {canScanWithWebcam() ? (
        <button type="button" className="button button--ghost" onClick={() => openSyncWithPhone(true)}>
          {t('Scan a code')}
        </button>
      ) : null}
    </section>
  );
}
