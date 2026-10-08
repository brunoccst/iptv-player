import { Fragment, useEffect } from 'react';
import { downloadsStore, stores, uiStore } from './appContext';
import { Spinner } from './components/Spinner';
import { LoginPage } from './features/auth/LoginPage';
import { SyncWithPhoneHost } from './features/pairing/SyncWithPhone';
import { ProfilePicker } from './features/profiles/ProfilePicker';
import { Shell } from './features/shell/Shell';
import { UpdateProgress } from './features/shell/UpdateProgress';
import { useSession } from './hooks/stores';
import { desktop } from './desktop';
import { desktopTexts } from './desktopTexts';
import { t, useUiLanguage } from '@iptv/shared';

/** Gate: restore session → login → profile picker → app shell. */
export function App() {
  const status = useSession((s) => s.status);
  const activeProfileId = useSession((s) => s.activeProfileId);
  const offline = useSession((s) => s.offline);
  const language = useUiLanguage();

  useEffect(() => {
    void stores.session.getState().restore();
    void downloadsStore.getState().init();
  }, []);

  useEffect(() => {
    if (offline) uiStore.getState().navigate('downloads');
  }, [offline]);

  // The desktop app's update dialogs speak the app's language too.
  useEffect(() => {
    void desktop?.setTexts?.(desktopTexts());
  }, [language]);

  // The whole app redraws in a newly chosen language (D-084).
  return (
    <Fragment key={language}>
      <Screen status={status} activeProfileId={activeProfileId} />
      <SyncWithPhoneHost />
      <UpdateProgress />
    </Fragment>
  );
}

function Screen({ status, activeProfileId }: { status: string; activeProfileId: string | null }) {
  if (status === 'idle' || status === 'restoring') {
    return (
      <div className="center-screen">
        <Spinner label={t('Starting')} />
      </div>
    );
  }
  if (status === 'anonymous') return <LoginPage />;
  if (!activeProfileId) return <ProfilePicker />;
  return <Shell />;
}
