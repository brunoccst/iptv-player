import { useEffect, useState, type FormEvent } from 'react';
import { createConnectionStore, createMemoryStorage, useAppStore, type ConnectionMode, t } from '@iptv/shared';
import { appConfig } from '../../config';
import { stores } from '../../appContext';
import { desktop } from '../../desktop';
import { AppLanguageSelect } from '../shell/AppLanguageDialog';
import { useSession } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { BackupDialog } from '../backup/BackupDialog';
import { usePairingServer } from '../pairing/pairing';
import { PairingCode } from '../pairing/SyncWithPhone';

/** Browsers have no direct mode (no connection store): a stand-in that always reads "My server". */
const serverOnly = createConnectionStore({ storage: createMemoryStorage(), defaultServerUrl: '' });
void serverOnly.getState().setConnection('server', '');

/**
 * Xtream login, laid out like the TV app's. The desktop app (D-071, D-072) offers "IPTV provider" (direct, default) or
 * "My server" (a backend, D-038) and, next to the form, sign-in by scanning a code with the phone app. In a browser the
 * page always goes through the backend: the credentials go to it once and the page keeps only a session token.
 */
export function LoginPage() {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const connection = stores.connection ?? serverOnly;
  const savedMode = useAppStore(connection, (s) => s.mode);
  const savedBackend = useAppStore(connection, (s) => s.serverUrl);
  const [mode, setMode] = useState<ConnectionMode>(savedMode);
  const [backendUrl, setBackendUrl] = useState(savedBackend);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [restore, setRestore] = useState(false);

  useEffect(() => {
    void stores.connection?.getState().load();
  }, []);
  useEffect(() => {
    setMode(savedMode);
    setBackendUrl(savedBackend);
  }, [savedMode, savedBackend]);

  const needsBackend = Boolean(desktop) && mode === 'server';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (desktop) await stores.connection?.getState().setConnection(mode, backendUrl.trim());
    await stores.session.getState().login({ serverUrl: serverUrl.trim(), username: username.trim(), password });
  };

  return (
    <main className="login">
      <h1 className="login__brand">{appConfig.appName}</h1>
      <div className="login__cards">
        <form className="login__panel" onSubmit={(event) => void submit(event)} aria-label={t('Sign in')}>
          <h2>{t('Sign In')}</h2>
          <AppLanguageSelect id="login-language" />
          {desktop ? (
            <div className="login__modes" role="radiogroup" aria-label={t('Connect to')}>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'direct'}
                className={mode === 'direct' ? 'chip chip--active' : 'chip'}
                onClick={() => setMode('direct')}
              >
                {t('IPTV provider')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'server'}
                className={mode === 'server' ? 'chip chip--active' : 'chip'}
                onClick={() => setMode('server')}
              >
                {t('My server')}
              </button>
            </div>
          ) : null}
          {needsBackend ? (
            <div className="field">
              <label htmlFor="backend-url">{t('My server address')}</label>
              <input
                id="backend-url"
                className="input"
                type="text"
                inputMode="url"
                placeholder="http://192.168.1.10:5080"
                required
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
              />
            </div>
          ) : null}
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
          <button type="submit" className="button button--accent" disabled={busy || (needsBackend && !backendUrl.trim())}>
            {busy ? t('Signing in…') : t('Sign In')}
          </button>
          <button type="button" className="button button--ghost" onClick={() => setRestore(true)}>
            {t('Restore from a backup')}
          </button>
          <p className="muted login__note">
            {desktop && mode === 'direct'
              ? t('The app talks to your IPTV provider directly. Your password stays on this computer, encrypted by the system.')
              : desktop
                ? t('Your IPTV password is sent once to your own backend, stored encrypted there, and never kept on this computer.')
                : t('Your IPTV password is sent once to your own backend, stored encrypted there, and never kept in this browser.')}
          </p>
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
