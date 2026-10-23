import { useState } from 'react';
import { setScreenHost, type ScreenHost } from '@iptv/screens';
import { navStore } from './appContext';
import { CardMenu } from './components/CardMenu';
import { CenteringScrollView } from './components/CenterScroll';
import { useTitleCard, useWatchlist } from './hooks';
import { colors, useNavHeight } from './theme';
import { blurTitle, focusTitle } from './tv/colourKeys';

/**
 * The TV and phone side of the screens shared with the desktop app (issue #237, DECISIONS.md#d-193): a page that keeps
 * the focused row in view, details as a panel over it, hold OK (a long touch) for a title's menu (D-078) and the
 * remote's colour keys (D-154). Imported by the modules that render shared screens, so it is set before they draw.
 */
const host: ScreenHost = {
  hooks: { useTitleCard, useWatchlist },
  openDetails: (section, masterId) => navStore.getState().push({ name: 'details', section, masterId }),
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
  TitleMenu: function TitleMenu({ title, items, children }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        {children(() => setOpen(true))}
        {open ? (
          <CardMenu
            title={title}
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
