import { useState, type FormEvent } from 'react';
import { appConfig } from '../../config';
import { stores } from '../../appContext';
import { useSession } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';

/** Xtream login. Credentials go to the backend once; the app keeps only a session token. */
export function LoginPage() {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void stores.session.getState().login({ serverUrl: serverUrl.trim(), username: username.trim(), password });
  };

  return (
    <main className="login">
      <h1 className="login__brand">{appConfig.appName}</h1>
      <form className="login__panel" onSubmit={submit} aria-label="Sign in">
        <h2>Sign In</h2>
        <div className="field">
          <label htmlFor="server-url">Server URL</label>
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
          <label htmlFor="username">Username</label>
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
          <label htmlFor="password">Password</label>
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
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
        <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          Your IPTV password is sent once to your own backend, stored encrypted there, and never kept in this browser.
        </p>
      </form>
    </main>
  );
}
