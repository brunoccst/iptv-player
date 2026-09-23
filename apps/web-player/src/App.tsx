import { useEffect } from 'react';
import { useAppStore } from '@iptv/shared';
import { appConfig } from './config';
import { stores } from './appContext';

export function App() {
  const status = useAppStore(stores.session, (state) => state.status);

  useEffect(() => {
    void stores.session.getState().restore();
  }, []);

  return (
    <main className="app-shell">
      <h1 className="app-title">{appConfig.appName}</h1>
      <p className="app-subtitle">
        Web player scaffold. API: {appConfig.apiBaseUrl} · Session: {status}
      </p>
    </main>
  );
}
