import { useEffect, useRef, useState } from 'react';
import { needsPinToOpen, selectActiveProfile, t, useUiLanguage } from '@iptv/shared';
import { appConfig } from '../../config';
import { desktop } from '../../desktop';
import { downloadsStore, signOut, stores, uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { usePin, useSession, useUi } from '../../hooks/stores';
import type { View } from '../../ui/uiStore';
import { BackupDialog } from '../backup/BackupDialog';
import { AboutDialog } from './AboutDialog';
import { AppLanguageDialog } from './AppLanguageDialog';
import { LogDialog } from './LogDialog';
import { openSyncWithPhone } from '../pairing/SyncWithPhone';
import { avatarColor } from '../profiles/avatar';
import { usePinGate } from '../profiles/PinDialog';
import { HiddenCategories } from '../profiles/HiddenCategories';
import { LanguageSettings } from '../profiles/LanguageSettings';
import { SubtitleSettings } from '../profiles/SubtitleSettings';
import { PinSettings } from '../profiles/PinSettings';

const LINKS: { view: View; label: () => string }[] = [
  { view: 'home', label: () => t('Home') },
  { view: 'series', label: () => t('Series') },
  { view: 'movies', label: () => t('Movies') },
  { view: 'live', label: () => t('Live TV') },
  { view: 'mylist', label: () => t('My List') },
  { view: 'downloads', label: () => t('My Downloads') },
];

/** Account menu groups; each opens in place with its name and a back arrow. */
/** The TV app's groups (D-079): Profiles, Library & devices, App. */
const GROUPS = ['Profiles', 'Library & devices', 'App'] as const;
type MenuGroup = (typeof GROUPS)[number];
const groupName = (group: MenuGroup) =>
  group === 'Profiles' ? t('Profiles') : group === 'Library & devices' ? t('Library & devices') : t('App');

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
  const menu = useRef<HTMLDivElement>(null);
  const [pinSettings, setPinSettings] = useState(false);
  const [backup, setBackup] = useState(false);
  const [language, setLanguage] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState(false);
  const [about, setAbout] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState(false);
  const [appLanguage, setAppLanguage] = useState(false);
  const uiLanguage = useUiLanguage();
  const [log, setLog] = useState(false);
  const pinStatus = usePin((s) => s.status);
  const { gate, dialog } = usePinGate();
  const ui = uiStore.getState();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The open menu stays open while the mouse moves off it; a click elsewhere or Escape closes it (issue #155).
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => {
      setMenuOpen(false);
      setGroup(null);
    };
    const onPointer = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
      menu.current?.querySelector<HTMLButtonElement>('.menu__avatar')?.focus();
    };
    window.addEventListener('mousedown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menuOpen]);

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
        <div className="menu" ref={menu}>
          <button
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
          {menuOpen ? (
            <div className="menu__list" role="menu">
              {group && !kids ? (
                <>
                  {/* The group's name with a back arrow: back to the main list. */}
                  <button
                    type="button"
                    role="menuitem"
                    className="menu__item menu__item--header"
                    aria-label={t('Back from {group}', { group: groupName(group) })}
                    onClick={() => setGroup(null)}
                  >
                    <Icon name="back" size={18} /> {groupName(group)}
                  </button>
                  {group === 'Profiles' ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => stores.session.getState().selectProfile(null)}
                      >
                        <Icon name="pencil" size={18} /> {t('Manage Profiles')}
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
                        <Icon name="lock" size={18} /> {t('Parental PIN')}
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
                        <Icon name="subtitles" size={18} /> {t('Content language filter')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setHiddenCategories(true);
                        }}
                      >
                        <Icon name="eyeOff" size={18} /> {t('Categories shown')}
                      </button>
                    </>
                  ) : group === 'Library & devices' ? (
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
                        <Icon name="refresh" size={18} /> {t('Refresh library')}
                      </button>
                      {/* Desktop app only (D-072). */}
                      {desktop ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="menu__item"
                          onClick={() => {
                            toggleMenu(false);
                            openSyncWithPhone();
                          }}
                        >
                          <Icon name="phone" size={18} /> {t('Sync with phone')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setBackup(true);
                        }}
                      >
                        <Icon name="backup" size={18} /> {t('Back up & restore')}
                      </button>
                    </>
                  ) : (
                    <>
                      {desktop ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="menu__item"
                          onClick={() => {
                            toggleMenu(false);
                            void desktop?.checkForUpdates();
                          }}
                        >
                          <Icon name="download" size={18} /> {t('Check for updates')}
                        </button>
                      ) : null}
                      {/* Also in English, so it can be found in a language one cannot read (D-084). */}
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setAppLanguage(true);
                        }}
                      >
                        <Icon name="globe" size={18} /> {t('App language')}
                        {uiLanguage === 'en' ? null : ' · App language'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setSubtitleSettings(true);
                        }}
                      >
                        <Icon name="subtitles" size={18} /> {t('Automatic subtitles')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setAbout(true);
                        }}
                      >
                        <Icon name="info" size={18} /> {t('About')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu__item"
                        onClick={() => {
                          toggleMenu(false);
                          setLog(true);
                        }}
                      >
                        <Icon name="log" size={18} /> {t('Log')}
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
                          gate(needsPinToOpen(pinStatus, profile, p), t('Enter the parental PIN to open {name}', { name: p.name }), () => {
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
                      <Icon name="pencil" size={18} /> {t('Switch profile')}
                    </button>
                  ) : null}
                  {(kids ? [] : GROUPS).map((name) => (
                    <button key={name} type="button" role="menuitem" className="menu__item" onClick={() => setGroup(name)}>
                      <Icon name={name === 'Profiles' ? 'pencil' : name === 'App' ? 'info' : 'refresh'} size={18} /> {groupName(name)}
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
                        if (hasDownloads && !window.confirm(t('Signing out deletes the downloads on this device. Sign out?'))) return;
                        void signOut();
                      }}
                    >
                      <Icon name="logout" size={18} /> {t('Sign out of {appName}', { appName: appConfig.appName })}
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
      {subtitleSettings ? <SubtitleSettings onClose={() => setSubtitleSettings(false)} /> : null}
      {hiddenCategories ? <HiddenCategories onClose={() => setHiddenCategories(false)} /> : null}
      {about ? <AboutDialog onClose={() => setAbout(false)} /> : null}
      {appLanguage ? <AppLanguageDialog onClose={() => setAppLanguage(false)} /> : null}
      {log ? <LogDialog onClose={() => setLog(false)} /> : null}
    </header>
  );
}
