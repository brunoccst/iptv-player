import { useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import { avatarColor, needsPinToOpen, selectActiveProfile, t, useUiLanguage } from '@iptv/shared';
import { navStore, signOut, stores, updater } from '../appContext';
import { appConfig, updateRepo } from '../config';
import { useNav, usePin, useSession } from '../hooks';
import { colors, fonts, radius, useNavHeight, useSizes } from '../theme';
import { TvMedia } from '../../modules/tv-media';
import { AboutDialog } from './AboutDialog';
import { AppLanguageDialog } from './AppLanguageDialog';
import { BackupDialog } from './BackupDialog';
import { HiddenCategories } from './HiddenCategories';
import { LanguageSettings } from './LanguageSettings';
import { PlaybackSettings } from './PlaybackSettings';
import { Icon, type IconName } from './Icon';
import { usePinGate } from './PinPad';
import { PinSettings } from './PinSettings';
import { SubtitleSettings } from './SubtitleSettings';
import { pairingDialog } from '../pairing/PairingDialogs';
import { focus } from './focus';

/** Asks first: signing out needs the provider password again and removes this account's downloads (D-050). */
export function confirmSignOut() {
  Alert.alert(t('Sign out?'), t('You will need your provider login to sign in again. Downloads on this device are deleted.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Sign out'), style: 'destructive', onPress: () => void signOut() },
  ]);
}

/** Asks first, then closes the app like "Force stop" in the system settings: the next start is a fresh one. */
export function confirmCloseApp() {
  Alert.alert(t('Close the app?'), t('The app closes completely, like "Force stop" in the settings. Downloads in progress stop.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Close the app'), style: 'destructive', onPress: () => void TvMedia.closeApp().catch(() => BackHandler.exitApp()) },
  ]);
}

/** Account menu under the nav avatar, same items as the web (plus Log, for sharing diagnostics). */
export function AccountMenu() {
  const open = useNav((s) => s.menuOpen);
  const groupName = useNav((s) => s.menuGroup);
  const profile = useSession(selectActiveProfile);
  const profiles = useSession((s) => s.profiles);
  const pinStatus = usePin((s) => s.status);
  const { gate, dialog } = usePinGate();
  const [pinSettings, setPinSettings] = useState(false);
  const [backup, setBackup] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [language, setLanguage] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState(false);
  const [about, setAbout] = useState(false);
  const [appLanguage, setAppLanguage] = useState(false);
  const uiLanguage = useUiLanguage();
  const sizes = useSizes();
  const navH = useNavHeight();

  // PIN prompts and the backup dialog outlive the menu: it closes before they open.
  const overlays = (
    <>
      {dialog}
      {pinSettings ? <PinSettings onClose={() => setPinSettings(false)} /> : null}
      {backup ? <BackupDialog mode="backup" onClose={() => setBackup(false)} /> : null}
      {playback ? <PlaybackSettings onClose={() => setPlayback(false)} /> : null}
      {language ? <LanguageSettings onClose={() => setLanguage(false)} /> : null}
      {hiddenCategories ? <HiddenCategories onClose={() => setHiddenCategories(false)} /> : null}
      {about ? <AboutDialog onClose={() => setAbout(false)} /> : null}
      {subtitleSettings ? <SubtitleSettings onClose={() => setSubtitleSettings(false)} /> : null}
      {appLanguage ? <AppLanguageDialog onClose={() => setAppLanguage(false)} /> : null}
    </>
  );
  if (!open) return overlays;

  const close = () => navStore.getState().setMenuOpen(false);
  const others = profiles.filter((p) => p.id !== profile?.id);
  /** Closes the menu, then opens a dialog or runs an action. */
  const then = (action: () => void) => () => {
    close();
    action();
  };
  // The menu shows other profiles, groups and Sign out; a group opens in place with its name and a back arrow.
  const groups: MenuGroup[] = [
    {
      id: 'profiles',
      name: t('Profiles'),
      icon: 'pencil',
      testID: 'menu-group-profiles',
      items: [
        {
          icon: 'pencil',
          label: t('Manage Profiles'),
          testID: 'menu-profiles',
          onPress: then(() => stores.session.getState().selectProfile(null)),
        },
        { icon: 'lock', label: t('Parental PIN'), testID: 'menu-pin', onPress: then(() => setPinSettings(true)) },
        { icon: 'subtitles', label: t('Content language filter'), testID: 'menu-language', onPress: then(() => setLanguage(true)) },
        // Categories left out of browsing; search still finds them (D-110).
        {
          icon: 'eyeOff',
          label: t('Categories shown'),
          testID: 'menu-hidden-categories',
          onPress: then(() => setHiddenCategories(true)),
        },
      ],
    },
    {
      id: 'library',
      name: t('Library & devices'),
      icon: 'refresh',
      testID: 'menu-group-library',
      items: [
        {
          icon: 'refresh',
          label: t('Refresh library'),
          testID: 'menu-refresh',
          onPress: then(() => void stores.library.getState().sync()),
        },
        // Phone-to-TV sign-in and sync (D-060): the TV shows a code, the phone scans it.
        {
          icon: Platform.isTV ? 'phone' : 'tv',
          label: Platform.isTV ? t('Sync with phone') : t('Connect a TV or computer'),
          testID: 'menu-pairing',
          onPress: then(() => pairingDialog.setState({ open: true })),
        },
        { icon: 'backup', label: t('Back up data'), testID: 'menu-backup', onPress: then(() => setBackup(true)) },
        // Only builds with the FFmpeg audio decoders have something to choose (D-059).
        ...(TvMedia.ffmpegAudioAvailable()
          ? [{ icon: 'subtitles' as const, label: t('Playback'), testID: 'menu-playback', onPress: then(() => setPlayback(true)) }]
          : []),
      ],
    },
    {
      id: 'app',
      name: t('App'),
      icon: 'info',
      testID: 'menu-group-app',
      items: [
        // Builds from the GitHub release can update themselves (D-062).
        ...(updateRepo
          ? [
              {
                icon: 'download' as const,
                label: t('Check for updates'),
                testID: 'menu-update',
                onPress: then(() => {
                  updater.open();
                  void updater.check();
                }),
              },
            ]
          : []),
        // Also in English, so it can be found in a language one cannot read (D-084).
        {
          icon: 'globe',
          label: uiLanguage === 'en' ? t('App language') : `${t('App language')} · App language`,
          testID: 'menu-app-language',
          onPress: then(() => setAppLanguage(true)),
        },
        // OpenSubtitles (D-111).
        {
          icon: 'subtitles',
          label: t('Automatic subtitles'),
          testID: 'menu-subtitles',
          onPress: then(() => setSubtitleSettings(true)),
        },
        { icon: 'info', label: t('About'), testID: 'menu-about', onPress: then(() => setAbout(true)) },
        { icon: 'log', label: t('Log'), testID: 'menu-log', onPress: () => navStore.getState().goSection('log') },
      ],
    },
  ];
  // Kids profiles only switch profile: no settings, sync, backup, updates, log or sign-out. Parents change a Kids
  // profile's categories and languages in the profile editor (behind the parental PIN when one is set).
  const kids = profile?.isKids === true;
  const openGroup = kids ? undefined : groups.find((group) => group.id === groupName);

  return (
    <>
      {overlays}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('Close menu')} focusable={false} />
      {/* TV: the D-pad stays in the menu until Back (or a pick) closes it; it used to walk down into the page (D-112). */}
      <TVFocusGuideView
        style={[styles.menu, { right: sizes.gutter, top: navH - 8 }]}
        accessibilityRole="menu"
        testID="account-menu"
        trapFocusUp={Platform.isTV}
        trapFocusDown={Platform.isTV}
        trapFocusLeft={Platform.isTV}
        trapFocusRight={Platform.isTV}
      >
        {openGroup ? (
          <>
            {/* The group's name with a back arrow: back to the main list (so does the Back key). */}
            <MenuItem
              key={`back-${openGroup.name}`}
              icon="back"
              label={openGroup.name}
              accessibilityLabel={t('Back from {name}', { name: openGroup.name })}
              header
              first
              testID="menu-back"
              onPress={() => navStore.getState().setMenuGroup(null)}
            />
            {openGroup.items.map((item) => (
              <MenuItem key={item.testID} {...item} />
            ))}
          </>
        ) : (
          <>
            {others.map((p, index) => (
              <MenuItem
                key={p.id}
                label={p.name}
                testID={`menu-profile-${p.id}`}
                first={index === 0}
                avatar={avatarColor(p)}
                onPress={then(() =>
                  // Leaving a Kids profile for a regular one needs the parental PIN when one is set (D-054).
                  gate(needsPinToOpen(pinStatus, profile, p), t('Enter the parental PIN to open {name}', { name: p.name }), () => {
                    stores.session.getState().selectProfile(p.id);
                    navStore.getState().goSection('home');
                  }),
                )}
              />
            ))}
            {kids ? (
              <MenuItem
                icon="pencil"
                label={t('Switch profile')}
                testID="menu-switch-profile"
                first={others.length === 0}
                onPress={then(() => stores.session.getState().selectProfile(null))}
              />
            ) : null}
            {(kids ? [] : groups).map((group, index) => (
              <MenuItem
                key={group.testID}
                icon={group.icon}
                label={group.name}
                testID={group.testID}
                first={others.length === 0 && index === 0}
                opens
                onPress={() => navStore.getState().setMenuGroup(group.id)}
              />
            ))}
            {kids ? null : (
              <MenuItem
                icon="logout"
                label={t('Sign out of {appName}', { appName: appConfig.appName })}
                testID="menu-sign-out"
                onPress={then(confirmSignOut)}
              />
            )}
            {/* On the main list, for every profile: no trip to Settings → Apps → Force stop (D-108). */}
            <MenuItem icon="close" label={t('Close the app')} testID="menu-close-app" onPress={then(confirmCloseApp)} />
          </>
        )}
      </TVFocusGuideView>
    </>
  );
}

interface MenuEntry {
  icon: IconName;
  label: string;
  testID: string;
  onPress(): void;
}

interface MenuGroup {
  /** Kept in the nav store while the group is open. */
  id: string;
  name: string;
  icon: IconName;
  testID: string;
  items: MenuEntry[];
}

function MenuItem({
  label,
  icon,
  avatar,
  first,
  opens,
  header,
  accessibilityLabel,
  testID,
  onPress,
}: {
  label: string;
  icon?: IconName;
  avatar?: string;
  first?: boolean;
  /** Opens a group: a chevron at the end. */
  opens?: boolean;
  /** A group's title row (bold, with a divider under it). */
  header?: boolean;
  accessibilityLabel?: string;
  testID: string;
  onPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="menuitem"
      accessibilityLabel={accessibilityLabel ?? label}
      hasTVPreferredFocus={first}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.item, header && styles.header, focused && styles.itemFocused]}
    >
      {avatar ? (
        <View style={[styles.miniAvatar, { backgroundColor: avatar }]}>
          <Text style={styles.miniAvatarText}>{label.charAt(0)}</Text>
        </View>
      ) : icon ? (
        <Icon name={icon} size={18} color={colors.text} />
      ) : null}
      <Text style={[styles.itemText, header && styles.headerText]}>{label}</Text>
      {opens ? (
        <View style={styles.chevron}>
          <Icon name="chevronRight" size={18} color={colors.muted} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    zIndex: 30,
    minWidth: 220,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    borderRadius: 8,
  },
  // Focused: a rounded translucent highlight inside the menu.
  itemFocused: { backgroundColor: focus.fill },
  itemText: { color: colors.text, fontSize: 14.4 },
  header: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  headerText: { color: colors.strong, fontWeight: '700' },
  chevron: { marginLeft: 'auto', paddingLeft: 16 },
  miniAvatar: { width: 26, height: 26, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: colors.strong, fontWeight: '700', fontSize: fonts.small },
});
