import { useEffect, useMemo, useState } from 'react';
import { setScreenHost, type DownloadEntry, type ScreenHost } from '@iptv/screens';

const NO_NOTES: string[] = [];
import { api, downloadsStore, navStore, stores } from './appContext';
import { t } from '@iptv/shared';
import { appConfig } from './config';
import { BackupDialog } from './components/BackupDialog';
import { chooseUiLanguage } from './components/AppLanguageDialog';
import { confirmSignOut } from './components/AccountMenu';
import { CardMenu } from './components/CardMenu';
import { KidsCategories } from './components/KidsCategories';
import { LanguageSettings } from './components/LanguageSettings';
import { usePinGate } from './components/PinPad';
import { CenteringScrollView } from './components/CenterScroll';
import {
  continueMenuItems,
  useCatalog,
  useChannelSearch,
  useDownloads,
  useHeroTitle,
  useLibrary,
  useLiveHomeRow,
  useNav,
  useOfflineAccess,
  usePagedLibrary,
  useProgrammeSearch,
  useProfileEditor,
  useProfilePicker,
  useMovieDetails,
  useProgrammeDescription,
  useProgress,
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
import { DownloadButton, useDownload } from './components/DownloadButton';
import { ExternalPlayerButton, useExternalPlayer } from './components/ExternalPlayerButton';
import { PlayOnTvButton, usePlayOnTv } from './components/PlayOnTvButton';
import { RegroupButton } from './components/RegroupButton';
import { useRemote } from './tv/remote';
import { useNavFocusTarget } from './components/TopNav';

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
    useReminders,
    useProgrammeDescription,
    useMovieDetails,
    useSeriesDetails,
    useWatchlistToggle,
  },
  api,
  stores,
  openDetails: (section, masterId) => navStore.getState().push({ name: 'details', section, masterId }),
  play: (target) => navStore.getState().push({ name: 'player', target }),
  openSection: (section, categoryId = null) =>
    section === 'mylist' ? navStore.getState().goSection('mylist') : navStore.getState().openCategory(section, categoryId),
  setScrolled: (scrolled) => navStore.getState().setScrolled(scrolled),
  signIn: {
    appName: appConfig.appName,
    note: () => t('The app talks to your IPTV provider directly. Your password stays on this device, stored encrypted.'),
    chooseLanguage: chooseUiLanguage,
    Restore: ({ onClose }) => <BackupDialog mode="restore" onClose={onClose} />,
    DeviceCode: function DeviceCode() {
      return <PairingCode state={usePairingServer()} size={170} />;
    },
    scan: { available: canScanQr, open: () => openPairingDialog('scan') },
  },
  profiles: { usePinGate, KidsCategories, LanguageSettings, signOut: confirmSignOut },
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
    DownloadButton: ({ target }) => <DownloadButton target={target} />,
    PlayOnTvButton: ({ target }) => <PlayOnTvButton target={target} testID="details-play-on-tv" />,
    ExternalPlayerButton: ({ target }) => <ExternalPlayerButton target={target} testID="details-external" />,
    RegroupButton,
    useEpisodeOptions: function useEpisodeOptions(target) {
      const download = useDownload(target);
      const playOnTv = usePlayOnTv(target);
      const external = useExternalPlayer(target);
      return {
        download,
        tvName: playOnTv?.tvName,
        playOnTv: playOnTv?.play,
        externalPlayer: external ? 'app' : null,
        openExternal: external?.open,
      };
    },
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
