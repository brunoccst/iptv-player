import { useEffect, useState } from 'react';
import { selectActiveProfile } from '@iptv/shared';
import { appConfig } from '../../config';
import { downloadsStore, signOut, stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { useSession, useUi } from '../../hooks/stores';
import type { View } from '../../ui/uiStore';
import { avatarColor } from '../profiles/avatar';

const LINKS: { view: View; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'series', label: 'Series' },
  { view: 'movies', label: 'Movies' },
  { view: 'live', label: 'Live TV' },
  { view: 'downloads', label: 'My Downloads' },
];

export function TopNav() {
  const view = useUi((s) => s.view);
  const search = useUi((s) => s.search);
  const profile = useSession(selectActiveProfile);
  const profiles = useSession((s) => s.profiles);
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ui = uiStore.getState();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav${solid || view !== 'home' ? ' nav--solid' : ''}`}>
      <button type="button" className="nav__brand" onClick={() => ui.navigate('home')}>
        {appConfig.appName}
      </button>
      <nav aria-label="Main">
        <ul className="nav__links">
          {LINKS.map((link) => (
            <li key={link.view}>
              <button
                type="button"
                className={`nav__link${view === link.view ? ' nav__link--active' : ''}`}
                aria-current={view === link.view ? 'page' : undefined}
                onClick={() => ui.navigate(link.view)}
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="nav__right">
        <input
          className="nav__search"
          type="search"
          placeholder="Titles, series"
          aria-label="Search"
          value={search}
          onChange={(e) => ui.setSearch(e.target.value)}
        />
        <div className="menu">
          <button
            type="button"
            className="menu__avatar"
            style={{ background: profile ? avatarColor(profile) : '#555' }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {profile?.name.charAt(0).toUpperCase()}
          </button>
          {menuOpen ? (
            <div className="menu__list" role="menu" onMouseLeave={() => setMenuOpen(false)}>
              {profiles
                .filter((p) => p.id !== profile?.id)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    className="menu__item"
                    onClick={() => {
                      setMenuOpen(false);
                      stores.session.getState().selectProfile(p.id);
                      ui.navigate('home');
                    }}
                  >
                    <span className="menu__avatar" style={{ background: avatarColor(p), width: 26, height: 26 }}>
                      {p.name.charAt(0)}
                    </span>
                    {p.name}
                  </button>
                ))}
              <button type="button" role="menuitem" className="menu__item" onClick={() => stores.session.getState().selectProfile(null)}>
                <Icon name="pencil" size={18} /> Manage Profiles
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  void stores.library.getState().sync();
                }}
              >
                <Icon name="refresh" size={18} /> Refresh library
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu__item"
                onClick={() => {
                  // Downloads belong to this account and are deleted on sign-out (D-050).
                  const hasDownloads = Object.keys(downloadsStore.getState().records).length > 0;
                  if (hasDownloads && !window.confirm('Signing out deletes the downloads on this device. Sign out?')) return;
                  void signOut();
                }}
              >
                <Icon name="logout" size={18} /> Sign out of {appConfig.appName}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
