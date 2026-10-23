import { useEffect, useMemo, useRef, useState } from 'react';
import { setScreenHost, type DownloadEntry } from '@iptv/screens';
import { formatBytes, t } from '@iptv/shared';
import { downloadsStore, stores, uiStore } from '../../appContext';
import { downloadProgress, posterPath } from '../../offline/types';
import { playTargetFromDownload } from '../../ui/targets';
import { CardMenu, menuPosition, type MenuPosition } from '../../components/CardMenu';
import {
  continueMenuItems,
  useCatalog,
  useChannelSearch,
  useDownloads,
  useHeroTitle,
  useLibrary,
  useLiveHomeRow,
  useOfflineAccess,
  usePagedLibrary,
  useProgrammeSearch,
  useProgress,
  useTitleCard,
  useUi,
  useWatchlist,
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
  },
  stores,
  openDetails: (section, masterId) => uiStore.getState().openDetails({ section, masterId }),
  play: (target) => uiStore.getState().play(target),
  // The desktop's Live TV page has its own category list, so it opens on All.
  openSection: (section, categoryId = null) =>
    section === 'mylist' || section === 'live'
      ? uiStore.getState().navigate(section)
      : uiStore.getState().openCategory(section, categoryId),
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
