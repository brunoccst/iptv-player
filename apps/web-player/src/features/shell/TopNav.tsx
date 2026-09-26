import { useEffect, useState } from 'react';
import { needsPinToOpen, selectActiveProfile } from '@iptv/shared';
import { appConfig } from '../../config';
import { downloadsStore, signOut, stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { usePin, useSession, useUi } from '../../hooks/stores';
import type { View } from '../../ui/uiStore';
import { BackupDialog } from '../backup/BackupDialog';
import { avatarColor } from '../profiles/avatar';
import { usePinGate } from '../profiles/PinDialog';
import { LanguageSettings } from '../profiles/LanguageSettings';
import { PinSettings } from '../profiles/PinSettings';

const LINKS: { view: View; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'series', label: 'Series' },
  { view: 'movies', label: 'Movies' },
  { view: 'live', label: 'Live TV' },
  { view: 'mylist', label: 'My List' },
  { view: 'downloads', label: 'My Downloads' },
];

/** Account menu groups; each opens in place with its name and a back arrow. */
const GROUPS = ['Profiles', 'Library & data'] as const;
type MenuGroup = (typeof GROUPS)[number];

export function TopNav() {
  const view = useUi((s) => s.view);
  const search = useUi((s) => s.search);
  const profile = useSession(selectActiveProfile);
  const kids = profile?.isKids === true;
  const profiles = useSession((s) => s.profiles);
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu's open group; `null` = the main list (other profiles, groups, Sign out).
  const [group, setGroup] = useState<MenuGroup | null>(null);
  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    setGroup(null);
  };
  const [pinSettings, setPinSettings] = useState(false);
  const [backup, setBackup] = useState(false);
  const [language, setLanguage] = useState(false);
  const pinStatus = usePin((s) => s.status);
  const { gate, dialog } = usePinGate();
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
            onClick={() => toggleMenu(!menuOpen)}
          >
            {profile?.name.charAt(0).toUpperCase()}
          </button>
          {menuOpen ? (
            <div className="menu__list" role="menu" onMouseLeave={() => toggleMenu(false)}>
              {group && !kids ? (
                <>
                  {/* The group's name with a back arrow: back to the main list. */}
                  <button
                    type="button"
                    role="menuitem"
                    className="menu__item menu__item--header"
                    aria-label={`Back from ${group}`}
                    onClick={() => setGroup(null)}
                  >
                    <Icon name="back" size={18} /> {group}
                  </button>
                  {group === 'Profiles' ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => stores.session.getState().selectProfile(null)}
                      >
                        <Icon name="pencil" size={18} /> Manage Profiles
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setPinSettings(true);
                        }}
                      >
                        <Icon name="lock" size={18} /> Parental PIN
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setLanguage(true);
                        }}
                      >
                        <Icon name="subtitles" size={18} /> Languages
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
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
                          toggleMenu(false);
                          setBackup(true);
                        }}
                      >
                        <Icon name="backup" size={18} /> Back up &amp; restore
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {profiles
                    .filter((p) => p.id !== profile?.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          // Leaving a Kids profile for a regular one needs the parental PIN when one is set (D-054).
                          gate(needsPinToOpen(pinStatus, profile, p), `Enter the parental PIN to open ${p.name}`, () => {
                            stores.session.getState().selectProfile(p.id);
                            ui.navigate('home');
                          });
                        }}
                      >
                        <span className="menu__avatar" style={{ background: avatarColor(p), width: 26, height: 26 }}>
                          {p.name.charAt(0)}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  {/* Kids profiles only switch profile: no settings, backup, refresh or sign-out. Parents set a Kids
                      profile's categories and languages in the profile editor (behind the PIN when one is set). */}
                  {kids ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="menu__item"
                      onClick={() => stores.session.getState().selectProfile(null)}
                    >
                      <Icon name="pencil" size={18} /> Switch profile
                    </button>
                  ) : null}
                  {(kids ? [] : GROUPS).map((name) => (
                    <button key={name} type="button" role="menuitem" className="menu__item" onClick={() => setGroup(name)}>
                      <Icon name={name === 'Profiles' ? 'pencil' : 'refresh'} size={18} /> {name}
                      <span className="menu__chevron" aria-hidden>
                        <Icon name="chevronRight" size={18} />
                      </span>
                    </button>
                  ))}
                  {kids ? null : (
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
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {dialog}
      {pinSettings ? <PinSettings onClose={() => setPinSettings(false)} /> : null}
      {backup ? <BackupDialog onClose={() => setBackup(false)} /> : null}
      {language ? <LanguageSettings onClose={() => setLanguage(false)} /> : null}
    </header>
  );
}
