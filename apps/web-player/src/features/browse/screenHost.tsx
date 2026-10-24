import { useEffect, useMemo, useRef, useState } from 'react';
import { BackupDialog, setScreenHost, type DownloadEntry } from '@iptv/screens';
import { formatBytes, t, type UiLanguage } from '@iptv/shared';
import { api, appContext, downloadsStore, stores, uiStore } from '../../appContext';
import { appConfig } from '../../config';
import { desktop } from '../../desktop';
import { backupFiles } from '../backup/backupFiles';
import { canScanWithWebcam, usePairingServer } from '../pairing/pairing';
import { openSyncWithPhone, PairingCode } from '../pairing/SyncWithPhone';
import { usePinGate } from '../profiles/PinDialog';
import { about } from '../shell/about';
import { LogDialog } from '../shell/LogDialog';
import { PinSettings } from '../profiles/PinSettings';
import { downloadProgress, posterPath } from '../../offline/types';
import { confirmSignOut } from '../../ui/signOut';
import { playTargetFromDownload } from '../../ui/targets';
import { CardMenu, menuBelow, menuPosition, type MenuPosition } from '../../components/CardMenu';
import { Modal } from '../../components/Modal';
import { useVlc } from '../../components/vlc';
import { useDownload } from '../../offline/useDownload';
import {
  continueMenuItems,
  useCatalog,
  useChannelSearch,
  useDownloads,
  useHeroTitle,
  useHiddenCategories,
  useKidsCategories,
  useLanguageSettings,
  useLibrary,
  useLiveHomeRow,
  useMergeCandidates,
  useMovieDetails,
  useOfflineAccess,
  usePagedLibrary,
  usePin,
  useProgrammeSearch,
  useProfileEditor,
  useProfilePicker,
  useProgrammeDescription,
  useProgress,
  useQualityUpgrades,
  useRegroup,
  useDueReminder,
  useReminders,
  useSeriesDetails,
  useSession,
  useTitleCard,
  useUi,
  useWatchlist,
  useWatchlistToggle,
} from '../../hooks/stores';

/**
 * The desktop side of the screens shared with the TV app, drawn through React Native Web (issue #237,
 * DECISIONS.md#d-194): the page scrolls with the window under the top nav, details open as the modal, a right-click
 * opens a title's menu at the pointer (D-079) and grids load more as their end scrolls into view. Imported by the
 * pages that show shared screens.
 */
setScreenHost({
  hooks: {
    useTitleCard,
    useWatchlist,
    usePagedLibrary,
    useCatalog,
    useLibrary,
    useProgress,
    useChannelSearch,
    useProgrammeSearch,
    useHeroTitle,
    useLiveHomeRow,
    continueMenuItems,
    useOfflineAccess,
    useSession,
    useProfilePicker,
    useProfileEditor,
    useDueReminder,
    useReminders,
    useProgrammeDescription,
    useMovieDetails,
    useSeriesDetails,
    useWatchlistToggle,
    useRegroup,
    useMergeCandidates,
    useQualityUpgrades,
    useKidsCategories,
    useHiddenCategories,
    useLanguageSettings,
    usePin,
  },
  api,
  subtitles: appContext.subtitles,
  stores,
  openDetails: (section, masterId) => uiStore.getState().openDetails({ section, masterId }),
  play: (target) => uiStore.getState().play(target),
  // The desktop's Live TV page has its own category list, so it opens on All.
  openSection: (section, categoryId = null) =>
    section === 'mylist' || section === 'live'
      ? uiStore.getState().navigate(section)
      : uiStore.getState().openCategory(section, categoryId),
  signIn: {
    appName: appConfig.appName,
    // A plain browser keeps nothing it could encrypt, and cannot pair (D-060).
    note: () =>
      desktop ? t('The app talks to your IPTV provider directly. Your password stays on this computer, encrypted by the system.') : null,
    chooseLanguage: (language) => void appContext.uiLanguage.choose(language as UiLanguage),
    Restore: ({ onClose }) => <BackupDialog mode="restore" onClose={onClose} />,
    DeviceCode: desktop
      ? function DeviceCode() {
          return <PairingCode state={usePairingServer()} size={180} />;
        }
      : undefined,
    scan: { available: canScanWithWebcam, open: () => openSyncWithPhone(true) },
  },
  about,
  backup: backupFiles,
  account: {
    PinSettings,
    backup: { label: () => t('Back up & restore'), Dialog: ({ onClose }) => <BackupDialog mode="both" onClose={onClose} /> },
    // The desktop app pairs; a plain browser cannot (D-060).
    sync: desktop ? { icon: 'phone', run: () => openSyncWithPhone() } : undefined,
    log: { Dialog: LogDialog },
    goHome: () => uiStore.getState().navigate('home'),
  },
  profiles: {
    usePinGate,
    signOut: confirmSignOut,
  },
  useDownloads: function useDesktopDownloads() {
    const records = useDownloads((s) => s.records);
    const supported = useDownloads((s) => s.supported);
    const estimate = useDownloads((s) => s.estimate);
    const entries = useMemo(
      () =>
        Object.values(records)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((record): DownloadEntry => ({
            id: record.id,
            title: record.title,
            subtitle: record.subtitle,
            // The copy saved with the download, so it shows offline; the provider's when there is none.
            posterUrl: record.posterUrl ? posterPath(record.id) : null,
            posterFallback: record.posterUrl,
            state: record.status === 'error' ? 'failed' : record.status,
            progress: downloadProgress(record),
            bytesDownloaded: record.bytesDownloaded,
            error: record.error,
            play: () => uiStore.getState().play(playTargetFromDownload(record)),
            pause: () => void downloadsStore.getState().pause(record.id),
            resume: () => void downloadsStore.getState().resume(record.id),
            remove: () => void downloadsStore.getState().remove(record.id),
          })),
      [records],
    );
    const notes = [
      ...(supported ? [] : [t('This browser does not support offline downloads.')]),
      ...(estimate
        ? [
            t('Using {used} of {available} available to this app.', {
              used: formatBytes(estimate.usage),
              available: formatBytes(estimate.quota),
            }),
          ]
        : []),
    ];
    return { entries, notes };
  },
  useSearch: () => ({ text: useUi((s) => s.search) }),
  useCategory: () => useUi((s) => s.categoryId),
  setCategory: (categoryId) => uiStore.getState().setCategory(categoryId),
  // A system notification when the window is in the background (issue #239); asked once, with the first reminder.
  allowReminders: () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
  },
  details: {
    close: () => uiStore.getState().closeDetails(),
    useRevision: () => useUi((s) => s.libraryRevision),
    useDownload,
    useExternalPlayer: function useVlcPlayer(target) {
      const vlc = useVlc();
      if (!vlc) return null;
      const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
      return { kind: 'vlc', label: t('Open {name} in VLC', { name }), open: () => vlc(target) };
    },
    replace: (section, masterId) => uiStore.getState().replaceDetails({ section, masterId }),
    Frame: ({ label, split, onClose, children }) => (
      <Modal label={label} onClose={onClose} fill={split}>
        {children}
      </Modal>
    ),
  },
  Menu: ({ title, subtitle, items, anchor, onClose }) => (
    <CardMenu
      title={title}
      subtitle={subtitle}
      // React Native Web's views are the page's elements: the menu opens under the button.
      position={anchor instanceof Element ? menuBelow(anchor) : { x: window.innerWidth / 2 - 100, y: window.innerHeight / 3 }}
      onClose={onClose}
      actions={items.map((item) => ({ label: item.label, icon: item.icon, disabled: item.disabled, onSelect: item.run }))}
    />
  ),
  Page: ({ children, testID }) => (
    <div data-testid={testID} style={{ padding: 'calc(var(--nav-height) + 24px) 0 60px' }}>
      {children}
    </div>
  ),
  TitleMenu: function TitleMenu({ title, subtitle, items, children }) {
    const [menu, setMenu] = useState<MenuPosition | null>(null);
    return (
      <div
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(menuPosition(event));
        }}
      >
        {children()}
        {menu ? (
          <CardMenu
            title={title}
            subtitle={subtitle}
            position={menu}
            onClose={() => setMenu(null)}
            actions={items().map((entry) => ({ label: entry.label, icon: entry.icon, onSelect: entry.run }))}
          />
        ) : null}
      </div>
    );
  },
  EndSensor: function EndSensor({ onReached }) {
    const sensor = useRef<HTMLDivElement>(null);
    const reached = useRef(onReached);
    reached.current = onReached;
    const autoLoad = typeof IntersectionObserver !== 'undefined';
    useEffect(() => {
      if (!autoLoad || !sensor.current) return;
      const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && reached.current(), {
        rootMargin: '600px 0px',
      });
      observer.observe(sensor.current);
      return () => observer.disconnect();
    }, [autoLoad]);
    return (
      <div className="grid__more" ref={sensor}>
        {autoLoad ? null : (
          <button type="button" className="button button--secondary" onClick={onReached}>
            {t('Load more')}
          </button>
        )}
      </div>
    );
  },
});
