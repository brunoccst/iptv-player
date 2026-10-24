import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { setScreenHost, type DownloadEntry, type ScreenHost } from '@iptv/screens';

const NO_NOTES: string[] = [];
import { api, appContext, downloadsStore, navStore, stores } from './appContext';
import { t, type UiLanguage } from '@iptv/shared';
import { appConfig } from './config';
import { BackupDialog } from './components/BackupDialog';
import { about } from './about';
import { confirmCloseApp, confirmSignOut } from './signOut';
import { PinSettings } from './components/PinSettings';
import { PlaybackSettings } from './components/PlaybackSettings';
import { TvMedia } from '../modules/tv-media';
import { CardMenu } from './components/CardMenu';
import { usePinGate } from './components/PinPad';
import { CenteringScrollView } from './components/CenterScroll';
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
  useNav,
  useOfflineAccess,
  usePagedLibrary,
  usePin,
  useProgrammeSearch,
  useProfileEditor,
  useProfilePicker,
  useMovieDetails,
  useProgrammeDescription,
  useProgress,
  useQualityUpgrades,
  useRegroup,
  useDueReminder,
  useReminders,
  useSeriesDetails,
  useSession,
  useTitleCard,
  useWatchlist,
  useWatchlistToggle,
} from './hooks';
import { colors, useNavHeight } from './theme';
import { canScanQr, usePairingServer } from './pairing/pairing';
import { openPairingDialog, PairingCode } from './pairing/PairingDialogs';
import { blurTitle, focusTitle, useColourPageTitle } from './tv/colourKeys';
import { useDownload } from './downloads/useDownload';
import { useExternalPlayer } from './player/useExternalPlayer';
import { usePlayOnTv } from './pairing/usePlayOnTv';
import { useRemote } from './tv/remote';
import { useNavFocusTarget } from '@iptv/screens';

/**
 * The TV and phone side of the screens shared with the desktop app (issue #237, DECISIONS.md#d-193): a page that keeps
 * the focused row in view, details as a panel over it, hold OK (a long touch) for a title's menu (D-078) and the
 * remote's colour keys (D-154). Imported by the modules that render shared screens, so it is set before they draw.
 */
const host: ScreenHost = {
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
  openDetails: (section, masterId) => navStore.getState().push({ name: 'details', section, masterId }),
  play: (target) => navStore.getState().push({ name: 'player', target }),
  openSection: (section, categoryId = null) =>
    section === 'mylist' ? navStore.getState().goSection('mylist') : navStore.getState().openCategory(section, categoryId),
  setScrolled: (scrolled) => navStore.getState().setScrolled(scrolled),
  signIn: {
    appName: appConfig.appName,
    note: () => t('The app talks to your IPTV provider directly. Your password stays on this device, stored encrypted.'),
    chooseLanguage: (language) => void appContext.uiLanguage.choose(language as UiLanguage),
    Restore: ({ onClose }) => <BackupDialog mode="restore" onClose={onClose} />,
    DeviceCode: function DeviceCode() {
      return <PairingCode state={usePairingServer()} size={170} />;
    },
    scan: { available: canScanQr, open: () => openPairingDialog('scan') },
  },
  about,
  account: {
    PinSettings,
    backup: { label: () => t('Back up data'), Dialog: ({ onClose }) => <BackupDialog mode="backup" onClose={onClose} /> },
    sync: { icon: Platform.isTV ? 'phone' : 'tv', run: () => openPairingDialog() },
    // Read when the menu draws: only builds with the FFmpeg audio decoders have something to choose (D-059).
    get playback() {
      return TvMedia.ffmpegAudioAvailable() ? { Dialog: PlaybackSettings } : null;
    },
    log: { run: () => navStore.getState().goSection('log') },
    closeApp: confirmCloseApp,
    goHome: () => navStore.getState().goSection('home'),
  },
  profiles: { usePinGate, signOut: confirmSignOut },
  useDownloads: function useTvDownloads() {
    const records = useDownloads((s) => s.records);
    useEffect(() => downloadsStore.getState().refresh(), []);
    const entries = useMemo(
      () =>
        Object.values(records)
          .filter((record) => record.state !== 'removing')
          .map((record): DownloadEntry => ({
            id: record.id,
            title: record.target.title,
            subtitle: record.target.subtitle,
            posterUrl: record.target.posterUrl,
            state: record.state === 'removing' ? 'unknown' : record.state,
            progress: record.progress,
            bytesDownloaded: record.bytesDownloaded,
            play: () => navStore.getState().push({ name: 'player', target: record.target }),
            pause: () => downloadsStore.getState().pause(record.id),
            resume: () => downloadsStore.getState().resume(record.id),
            remove: () => downloadsStore.getState().remove(record.id),
          })),
      [records],
    );
    return { entries, notes: NO_NOTES };
  },
  useSearch: () => ({ text: useNav((s) => s.search), submits: useNav((s) => s.searchSubmits) }),
  useCategory: () => useNav((s) => s.categoryId),
  setCategory: (categoryId) => navStore.getState().setCategory(categoryId),
  useRemote,
  useNavFocusTarget,
  Page: function Page({ children, testID }) {
    const navH = useNavHeight();
    return (
      <CenteringScrollView
        onlyCentering
        style={{ flex: 1, backgroundColor: colors.bg }}
        testID={testID}
        contentContainerStyle={{ paddingTop: navH + 24, paddingBottom: 60 }}
      >
        {children}
      </CenteringScrollView>
    );
  },
  TitleMenu: function TitleMenu({ title, subtitle, items, children }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        {children(() => setOpen(true))}
        {open ? (
          <CardMenu
            title={title}
            subtitle={subtitle}
            onClose={() => setOpen(false)}
            actions={items().map((entry) => ({
              label: entry.label,
              icon: entry.icon,
              testID: `card-menu-${entry.id}`,
              onPress: entry.run,
            }))}
          />
        ) : null}
      </>
    );
  },
  details: {
    close: () => navStore.getState().back(),
    useRevision: () => useNav((s) => s.libraryRevision),
    useDownload,
    usePlayOnTv,
    useExternalPlayer,
    replace: (section, masterId) => navStore.getState().replaceTop({ name: 'details', section, masterId }),
    usePageTitle: (section, card) => useColourPageTitle({ section, card }),
  },
  Menu: ({ title, subtitle, items, onClose }) => (
    <CardMenu
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      actions={items.map((item) => ({
        label: item.label,
        disabled: item.disabled,
        icon: item.icon,
        testID: `card-menu-${item.id}`,
        onPress: item.run,
      }))}
    />
  ),
  focusTitle: (section, card) => focusTitle({ section, card }),
  blurTitle,
};

setScreenHost(host);
