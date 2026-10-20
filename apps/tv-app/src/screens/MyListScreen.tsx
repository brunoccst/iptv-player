import { MyListScreen as SharedMyListScreen, type MyListParts } from '@iptv/screens';
import { watchlistCard } from '@iptv/shared';
import { CenteringScrollView } from '../components/CenterScroll';
import { FocusRow } from '../components/FocusRow';
import { useWatchlist } from '../hooks';
import { colors, useNavHeight, useSizes } from '../theme';
import { MasterCardItem, useGridColumns } from './titles';

/** The TV and phone parts of the shared screen: the focus page, focus rows (D-069) and the app's title cards. */
const parts: MyListParts = {
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
  Row: ({ children, style }) => <FocusRow style={style}>{children}</FocusRow>,
  Card: ({ item, width, first }) => (
    <MasterCardItem section={item.section} item={watchlistCard(item)} width={width} hasTVPreferredFocus={first} />
  ),
};

/** "My List" (D-055): the screen shared with the desktop app (issue #237, DECISIONS.md#d-193) with the TV's parts. */
export function MyListScreen() {
  const items = useWatchlist((s) => s.items);
  const { columns, itemWidth } = useGridColumns();
  const sizes = useSizes();
  return (
    <SharedMyListScreen
      items={items.data}
      loading={items.status === 'loading'}
      columns={columns}
      itemWidth={itemWidth}
      gutter={sizes.gutter}
      titleSize={sizes.pageTitle}
      parts={parts}
    />
  );
}
