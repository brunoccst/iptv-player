import { Fragment, useEffect } from 'react';
import { downloadsStore, stores, uiStore } from './appContext';
import { Spinner } from './components/Spinner';
import { LoginPage } from './features/auth/LoginPage';
import { SyncWithPhoneHost } from './features/pairing/SyncWithPhone';
import { useAutoSync, useRemoteServer } from './features/pairing/pairing';
import { startBackgroundDownloads } from './features/downloads/backgroundDownloads';
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
  // The desktop app stays in step with the TV it scanned (issue #227).
  useAutoSync(status === 'authenticated');
  // Phones that scanned this computer's code sync with it too (issue #268).
  useRemoteServer(status === 'authenticated');

  useEffect(() => {
    void stores.session.getState().restore();
    void downloadsStore.getState().init();
    // Desktop: downloads go on with the window closed (issue #219).
    return startBackgroundDownloads();
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
