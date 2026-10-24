import { useCallback, useEffect, useState } from 'react';
import { AccountMenu, TopNav as SharedTopNav, type AccountMenuGroup, type NavSection } from '@iptv/screens';
import '../browse/screenHost';
import { uiStore } from '../../appContext';
import { useUi } from '../../hooks/stores';

const navigate = (section: NavSection) => uiStore.getState().navigate(section);
const setSearch = (text: string) => uiStore.getState().setSearch(text);

/**
 * The top nav and account menu shared with the TV app (issue #237, DECISIONS.md#d-207, #d-208). The window scrolls under
 * it: past 10 px the bar turns solid. The menu stays open while the mouse moves off it; a click beside it, the avatar or
 * Escape closes it (issue #155).
 */
export function TopNav() {
  const view = useUi((s) => s.view);
  const search = useUi((s) => s.search);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu's open group; `null` = the main list (other profiles, groups, Sign out).
  const [group, setGroup] = useState<AccountMenuGroup | null>(null);
  const toggleMenu = useCallback((open: boolean) => {
    setMenuOpen(open);
    setGroup(null);
  }, []);
  const closeMenu = useCallback(() => toggleMenu(false), [toggleMenu]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <SharedTopNav
      section={view}
      search={search}
      solid={scrolled || view !== 'home'}
      menuOpen={menuOpen}
      onSection={navigate}
      onSearch={setSearch}
      onMenu={toggleMenu}
      menu={<AccountMenu open={menuOpen} group={group} onGroup={setGroup} onClose={closeMenu} placement={{ top: 42, right: 0 }} />}
    />
  );
}
