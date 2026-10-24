import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountMenu, type AccountMenuGroup } from '@iptv/screens';
import { selectActiveProfile, t } from '@iptv/shared';
import '../browse/screenHost';
import { appConfig } from '../../config';
import { uiStore } from '../../appContext';
import { useSession, useUi } from '../../hooks/stores';
import type { View } from '../../ui/uiStore';
import { avatarColor } from '../profiles/avatar';

const LINKS: { view: View; label: () => string }[] = [
  { view: 'home', label: () => t('Home') },
  { view: 'series', label: () => t('Series') },
  { view: 'movies', label: () => t('Movies') },
  { view: 'live', label: () => t('Live TV') },
  { view: 'mylist', label: () => t('My List') },
  { view: 'downloads', label: () => t('My Downloads') },
];

export function TopNav() {
  const view = useUi((s) => s.view);
  const search = useUi((s) => s.search);
  const profile = useSession(selectActiveProfile);
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu's open group; `null` = the main list (other profiles, groups, Sign out).
  const [group, setGroup] = useState<AccountMenuGroup | null>(null);
  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    setGroup(null);
  };
  const ui = uiStore.getState();
  const avatar = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setGroup(null);
    avatar.current?.focus();
  }, []);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav${solid || view !== 'home' ? ' nav--solid' : ''}`}>
      {/* Plain text, not a link: "Home" already goes home (D-094). */}
      <span className="nav__brand">{appConfig.appName}</span>
      <nav aria-label={t('Main')}>
        <ul className="nav__links">
          {LINKS.map((link) => (
            <li key={link.view}>
              <button
                type="button"
                className={`nav__link${view === link.view ? ' nav__link--active' : ''}`}
                aria-current={view === link.view ? 'page' : undefined}
                onClick={() => ui.navigate(link.view)}
              >
                {link.label()}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="nav__right">
        <input
          className="nav__search"
          type="search"
          placeholder={t('Titles, series')}
          aria-label={t('Search')}
          value={search}
          onChange={(e) => ui.setSearch(e.target.value)}
        />
        <div className="menu">
          <button
            ref={avatar}
            type="button"
            className="menu__avatar"
            style={{ background: profile ? avatarColor(profile) : '#555' }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('Account menu')}
            onClick={() => toggleMenu(!menuOpen)}
          >
            {profile?.name.charAt(0).toUpperCase()}
          </button>
          {/* Shared with the TV app (issue #237, DECISIONS.md#d-207); it stays open while the mouse moves off it, and a
              click elsewhere or Escape closes it (issue #155). */}
          <AccountMenu open={menuOpen} group={group} onGroup={setGroup} onClose={closeMenu} placement={{ top: 42, right: 0 }} />
        </div>
      </div>
    </header>
  );
}
