import { useEffect } from 'react';
import { downloadsStore, stores, uiStore } from './appContext';
import { Spinner } from './components/Spinner';
import { LoginPage } from './features/auth/LoginPage';
import { ProfilePicker } from './features/profiles/ProfilePicker';
import { Shell } from './features/shell/Shell';
import { useSession } from './hooks/stores';

/** Gate: restore session → login → profile picker → app shell. */
export function App() {
  const status = useSession((s) => s.status);
  const activeProfileId = useSession((s) => s.activeProfileId);
  const offline = useSession((s) => s.offline);

  useEffect(() => {
    void stores.session.getState().restore();
    void downloadsStore.getState().init();
  }, []);

  useEffect(() => {
    if (offline) uiStore.getState().navigate('downloads');
  }, [offline]);

  if (status === 'idle' || status === 'restoring') {
    return <div className="center-screen"><Spinner label="Starting" /></div>;
  }
  if (status === 'anonymous') return <LoginPage />;
  if (!activeProfileId) return <ProfilePicker />;
  return <Shell />;
}
