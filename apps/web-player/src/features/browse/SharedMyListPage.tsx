import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { MyListScreen, PosterTile, type MyListParts } from '@iptv/screens';
import { fluidSizes, watchlistCard } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { CardMenu, menuPosition, type MenuPosition } from '../../components/CardMenu';
import { useTitleCard, useWatchlist } from '../../hooks/stores';

/** Cards sit this far apart, like the app's own grid. */
const GAP = 8;

/**
 * My List from the screen shared with the TV app, through React Native Web (issue #237, DECISIONS.md#d-193): a trial
 * next to `MyListPage`, loaded on its own so the rest of the app does not carry React Native Web.
 */
export function SharedMyListPage() {
  const items = useWatchlist((s) => s.items);
  const { width } = useWindowDimensions();
  const { gutter, cardWidth } = fluidSizes(width);
  const available = width - gutter * 2;
  const columns = Math.max(1, Math.floor((available + GAP) / (cardWidth + GAP)));
  return (
    <MyListScreen
      items={items.data}
      loading={items.status === 'loading'}
      columns={columns}
      itemWidth={Math.floor((available - GAP * (columns - 1)) / columns)}
      gutter={gutter}
      titleSize={Math.min(32, Math.max(22.4, width * 0.025))}
      parts={parts}
    />
  );
}

/** The desktop parts: the page scrolls with the window; a card opens details, a right-click its menu (D-079). */
const parts: MyListParts = {
  Page: ({ children, testID }) => (
    <div data-testid={testID} style={{ padding: 'calc(var(--nav-height) + 24px) 0 60px' }}>
      {children}
    </div>
  ),
  Row: ({ children, style }) => <View style={style}>{children}</View>,
  Card: function Card({ item, width }) {
    const card = watchlistCard(item);
    const [menu, setMenu] = useState<MenuPosition | null>(null);
    const openDetails = () => uiStore.getState().openDetails({ section: item.section, masterId: card.id });
    const title = useTitleCard(item.section, card, openDetails);
    return (
      <div
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(menuPosition(event));
        }}
      >
        <PosterTile
          title={card.title}
          posterUrl={card.posterUrl}
          badge={title.badge}
          watched={title.watched}
          onList={title.onList}
          subtitle={title.subtitle}
          width={width}
          onPress={openDetails}
        />
        {menu ? (
          <CardMenu
            title={card.title}
            position={menu}
            onClose={() => setMenu(null)}
            actions={title.menuItems().map((entry) => ({ label: entry.label, icon: entry.icon, onSelect: entry.run }))}
          />
        ) : null}
      </div>
    );
  },
};
