import { useEffect, useRef, useState } from 'react';
import { setScreenHost } from '@iptv/screens';
import { t } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { CardMenu, menuPosition, type MenuPosition } from '../../components/CardMenu';
import {
  continueMenuItems,
  useCatalog,
  useChannelSearch,
  useHeroTitle,
  useLibrary,
  useLiveHomeRow,
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
  },
  stores,
  openDetails: (section, masterId) => uiStore.getState().openDetails({ section, masterId }),
  play: (target) => uiStore.getState().play(target),
  // The desktop's Live TV page has its own category list, so it opens on All.
  openSection: (section, categoryId = null) =>
    section === 'mylist' || section === 'live'
      ? uiStore.getState().navigate(section)
      : uiStore.getState().openCategory(section, categoryId),
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
