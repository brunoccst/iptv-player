import { useEffect, useMemo, useState } from 'react';
import { setScreenHost, type DownloadEntry, type ScreenHost } from '@iptv/screens';

const NO_NOTES: string[] = [];
import { downloadsStore, navStore, stores } from './appContext';
import { CardMenu } from './components/CardMenu';
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
  useProgress,
  useTitleCard,
  useWatchlist,
} from './hooks';
import { colors, useNavHeight } from './theme';
import { blurTitle, focusTitle } from './tv/colourKeys';

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
  },
  stores,
  openDetails: (section, masterId) => navStore.getState().push({ name: 'details', section, masterId }),
  play: (target) => navStore.getState().push({ name: 'player', target }),
  openSection: (section, categoryId = null) =>
    section === 'mylist' ? navStore.getState().goSection('mylist') : navStore.getState().openCategory(section, categoryId),
  setScrolled: (scrolled) => navStore.getState().setScrolled(scrolled),
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
  focusTitle: (section, card) => focusTitle({ section, card }),
  blurTitle,
};

setScreenHost(host);
