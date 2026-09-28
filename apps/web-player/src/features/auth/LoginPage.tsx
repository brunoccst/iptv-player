import { useState, type FormEvent } from 'react';
import { t } from '@iptv/shared';
import { appConfig } from '../../config';
import { stores } from '../../appContext';
import { desktop } from '../../desktop';
import { AppLanguageSelect } from '../shell/AppLanguageDialog';
import { useSession } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { BackupDialog } from '../backup/BackupDialog';
import { usePairingServer } from '../pairing/pairing';
import { PairingCode } from '../pairing/SyncWithPhone';

/**
 * Xtream login, laid out like the TV app's: the app talks to the provider directly (D-038, D-071, D-088). The desktop
 * app also offers, next to the form, sign-in by scanning a code with the phone app (D-072).
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

/** Desktop app: sign in by scanning this code with the phone app, as on the TV (D-060, D-072). */
function PhoneSignIn() {
  const state = usePairingServer();
  return (
    <section className="login__phone" aria-label={t('Sign in with your phone')} data-testid="login-phone">
      <h3>{t('Sign in with your phone')}</h3>
      <PairingCode state={state} size={180} />
      <p className="muted login__note">{t('In the app on your phone: account menu → Connect a TV or computer, then scan this code.')}</p>
    </section>
  );
}
