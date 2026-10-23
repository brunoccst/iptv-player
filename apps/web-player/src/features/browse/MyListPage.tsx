import { useState } from 'react';
import { MyListScreen, ScreenHostProvider, type ScreenHost } from '@iptv/screens';
import { uiStore } from '../../appContext';
import { CardMenu, menuPosition, type MenuPosition } from '../../components/CardMenu';
import { useTitleCard, useWatchlist } from '../../hooks/stores';

/**
 * The desktop side of the screens shared with the TV app, drawn through React Native Web (issue #237,
 * DECISIONS.md#d-193): the page scrolls with the window under the top nav, details open as the modal and a right-click
 * opens a title's menu at the pointer (D-079).
 */
const host: ScreenHost = {
  hooks: { useTitleCard, useWatchlist },
  openDetails: (section, masterId) => uiStore.getState().openDetails({ section, masterId }),
  Page: ({ children, testID }) => (
    <div data-testid={testID} style={{ padding: 'calc(var(--nav-height) + 24px) 0 60px' }}>
      {children}
    </div>
  ),
  TitleMenu: function TitleMenu({ title, items, children }) {
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
            position={menu}
            onClose={() => setMenu(null)}
            actions={items().map((entry) => ({ label: entry.label, icon: entry.icon, onSelect: entry.run }))}
          />
        ) : null}
      </div>
    );
  },
};

/** "My List" (D-055): the screen shared with the TV app, loaded on its own so the rest of the app does not carry React Native Web. */
export function MyListPage() {
  return (
    <ScreenHostProvider value={host}>
      <MyListScreen />
    </ScreenHostProvider>
  );
}
