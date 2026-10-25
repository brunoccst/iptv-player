import { useEffect, useState, type ReactNode } from 'react';
// Read through the namespace: React Native Web (desktop) has no TVFocusGuideView, and a named import of it fails there.
import * as ReactNative from 'react-native';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { avatarColor, needsPinToOpen, selectActiveProfile, t, useUiLanguage } from '@iptv/shared';
import { useScreenHost, type MenuAction } from './host';
import { AboutDialog } from './AboutDialog';
import { AppLanguageDialog } from './AppLanguageDialog';
import { HiddenCategories } from './HiddenCategories';
import { LanguageSettings } from './LanguageSettings';
import { usePinGate } from './PinPad';
import { PinSettings } from './PinSettings';
import { ProviderAccount } from './ProviderAccount';
import { StartupDialog } from './StartupDialog';
import { SubtitleSettings } from './SubtitleSettings';
import { Icon, type IconName } from './ui/Icon';
import { focus } from './ui/focus';
import { colors, fonts, radius, useNavHeight, useSizes } from './ui/theme';

/** The groups of the main list (D-079); each opens in place with its name and a back arrow. */
export type AccountMenuGroup = 'profiles' | 'library' | 'app';

type DialogName =
  'pin' | 'backup' | 'playback' | 'language' | 'hidden' | 'subtitles' | 'about' | 'appLanguage' | 'log' | 'sync' | 'startup' | 'provider';

/**
 * The account menu under the top nav's avatar (D-079), the same on every app (issue #237, DECISIONS.md#d-207): other
 * profiles, three groups and Sign out. The app keeps whether it is open and its open group (TV: Back leaves a group,
 * then closes it) and brings the items only it has through `ScreenHost.account`. The dialogs it opens outlive it: the
 * menu closes before they open.
 */
export function AccountMenu({
  open,
  group,
  onGroup,
  onClose,
  placement,
}: {
  open: boolean;
  /** The open group; `null`: the main list. */
  group: string | null;
  onGroup(group: AccountMenuGroup | null): void;
  onClose(): void;
  /** Where the list hangs; TV and phone: under the avatar at the right of the screen. */
  placement?: { top: number; right: number };
}) {
  const host = useScreenHost();
  const { account, stores, profiles: profileHost } = host;
  const profile = host.hooks.useSession(selectActiveProfile);
  const profiles = host.hooks.useSession((s) => s.profiles);
  const pinStatus = host.hooks.usePin((s) => s.status);
  const { gate, dialog } = usePinGate();
  const uiLanguage = useUiLanguage();
  const [shown, setShown] = useState<DialogName | null>(null);
  const sizes = useSizes();
  const navH = useNavHeight();

  // Desktop: Escape closes it, before the page's own keys see it (issue #155).
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const hide = () => setShown(null);
  const dialogOf = (action: MenuAction | undefined) => (action && 'Dialog' in action ? <action.Dialog onClose={hide} /> : null);
  const overlays = (
    <>
      {dialog}
      {shown === 'pin' ? <PinSettings onClose={hide} /> : null}
      {shown === 'backup' ? dialogOf(account.backup) : null}
      {shown === 'playback' ? dialogOf(account.playback ?? undefined) : null}
      {shown === 'sync' ? dialogOf(account.sync) : null}
      {shown === 'log' ? dialogOf(account.log) : null}
      {shown === 'language' ? <LanguageSettings onClose={hide} /> : null}
      {shown === 'hidden' ? <HiddenCategories onClose={hide} /> : null}
      {shown === 'about' ? <AboutDialog onClose={hide} /> : null}
      {shown === 'subtitles' ? <SubtitleSettings onClose={hide} /> : null}
      {shown === 'appLanguage' ? <AppLanguageDialog onClose={hide} /> : null}
      {shown === 'startup' ? <StartupDialog onClose={hide} /> : null}
      {shown === 'provider' ? <ProviderAccount onClose={hide} /> : null}
    </>
  );
  if (!open) return overlays;

  /** Closes the menu, then opens a dialog or runs an action. */
  const then = (action: () => void) => () => {
    onClose();
    action();
  };
  const show = (name: DialogName) => then(() => setShown(name));
  const run = (name: DialogName, action: MenuAction) => ('run' in action ? then(action.run) : show(name));
  const switchProfile = then(() => stores.session.getState().selectProfile(null));
  const groups: { id: AccountMenuGroup; name: string; icon: IconName; items: Entry[] }[] = [
    {
      id: 'profiles',
      name: t('Profiles'),
      icon: 'pencil',
      items: [
        { icon: 'pencil', label: t('Manage Profiles'), testID: 'menu-profiles', onPress: switchProfile },
        { icon: 'lock', label: t('Parental PIN'), testID: 'menu-pin', onPress: show('pin') },
        { icon: 'subtitles', label: t('Content language filter'), testID: 'menu-language', onPress: show('language') },
        // Categories left out of browsing; search still finds them (D-110).
        { icon: 'eyeOff', label: t('Categories shown'), testID: 'menu-hidden-categories', onPress: show('hidden') },
      ],
    },
    {
      id: 'library',
      name: t('Library & devices'),
      icon: 'refresh',
      items: [
        {
          icon: 'refresh',
          label: t('Refresh library'),
          testID: 'menu-refresh',
          onPress: then(() => void stores.library.getState().sync()),
        },
        // Sign-in and sync between devices (D-060, D-178): every device shows a code, devices with a camera scan one.
        ...(account.sync
          ? [{ icon: account.sync.icon, label: t('Sync with another device'), testID: 'menu-pairing', onPress: run('sync', account.sync) }]
          : []),
        { icon: 'backup', label: account.backup.label(), testID: 'menu-backup', onPress: run('backup', account.backup) },
        // Only TV builds with the FFmpeg audio decoders have something to choose (D-059).
        ...(account.playback
          ? [{ icon: 'subtitles' as const, label: t('Playback'), testID: 'menu-playback', onPress: run('playback', account.playback) }]
          : []),
      ],
    },
    {
      id: 'app',
      name: t('App'),
      icon: 'info',
      items: [
        // Builds from the GitHub release can update themselves (D-062).
        ...(host.about.checkForUpdates
          ? [{ icon: 'download' as const, label: t('Check for updates'), testID: 'menu-update', onPress: then(host.about.checkForUpdates) }]
          : []),
        // Also in English, so it can be found in a language one cannot read (D-084).
        {
          icon: 'globe',
          label: uiLanguage === 'en' ? t('App language') : `${t('App language')} · App language`,
          testID: 'menu-app-language',
          onPress: show('appLanguage'),
        },
        // The desktop starts in the tray at sign-in, so guide reminders show with the window closed (issue #309).
        ...(account.startup
          ? [{ icon: 'restart' as const, label: t('Start with the computer'), testID: 'menu-startup', onPress: show('startup') }]
          : []),
        // OpenSubtitles (D-111).
        { icon: 'subtitles', label: t('Automatic subtitles'), testID: 'menu-subtitles', onPress: show('subtitles') },
        { icon: 'info', label: t('About'), testID: 'menu-about', onPress: show('about') },
        { icon: 'log', label: t('Log'), testID: 'menu-log', onPress: run('log', account.log) },
      ],
    },
  ];
  // Kids profiles only switch profile: no settings, sync, backup, updates, log or sign-out. Parents change a Kids
  // profile's categories and languages in the profile editor (behind the parental PIN when one is set).
  const kids = profile?.isKids === true;
  const openGroup = kids ? undefined : groups.find((entry) => entry.id === group);
  const others = profiles.filter((p) => p.id !== profile?.id);
  const where = placement ?? { top: navH - 8, right: sizes.gutter };
  const { TVFocusGuideView } = ReactNative;
  const Trap = TVFocusGuideView ?? View;
  const trap = Platform.isTV;

  return (
    <>
      {overlays}
      <Pressable
        style={[StyleSheet.absoluteFill, Platform.OS === 'web' && webFixed]}
        onPress={onClose}
        accessibilityLabel={t('Close menu')}
        focusable={false}
      />
      {/* TV: the D-pad stays in the menu until Back (or a pick) closes it; it used to walk down into the page (D-069). */}
      <Trap
        style={[styles.menu, Platform.OS === 'web' && webWidth, where]}
        role="menu"
        testID="account-menu"
        {...(Platform.OS === 'web' ? {} : { trapFocusUp: trap, trapFocusDown: trap, trapFocusLeft: trap, trapFocusRight: trap })}
      >
        {openGroup ? (
          <>
            {/* The group's name with a back arrow: back to the main list (so does the Back key). */}
            <MenuItem
              key={`back-${openGroup.id}`}
              icon="back"
              label={openGroup.name}
              accessibilityLabel={t('Back from {name}', { name: openGroup.name })}
              header
              first
              testID="menu-back"
              onPress={() => onGroup(null)}
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
                    account.goHome();
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
                onPress={switchProfile}
              />
            ) : null}
            {(kids ? [] : groups).map((entry, index) => (
              <MenuItem
                key={entry.id}
                icon={entry.icon}
                label={entry.name}
                testID={`menu-group-${entry.id}`}
                first={others.length === 0 && index === 0}
                opens
                onPress={() => onGroup(entry.id)}
              />
            ))}
            {/* The provider's server, username and password, changed without signing out (DECISIONS.md#d-228). */}
            {kids ? null : <MenuItem icon="tv" label={t('IPTV account')} testID="menu-provider-account" onPress={show('provider')} />}
            {kids ? null : (
              <MenuItem
                icon="logout"
                label={t('Sign out of {appName}', { appName: host.signIn.appName })}
                testID="menu-sign-out"
                onPress={then(profileHost.signOut)}
              />
            )}
            {/* TV and phone, for every profile: no trip to Settings → Apps → Force stop. */}
            {account.closeApp ? (
              <MenuItem icon="close" label={t('Close the app')} testID="menu-close-app" onPress={then(account.closeApp)} />
            ) : null}
          </>
        )}
      </Trap>
    </>
  );
}

interface Entry {
  icon: IconName;
  label: string;
  testID: string;
  onPress(): void;
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
}): ReactNode {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="menuitem"
      accessibilityLabel={accessibilityLabel ?? label}
      hasTVPreferredFocus={Platform.OS === 'web' ? undefined : first}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setFocused(true)}
      onHoverOut={() => setFocused(false)}
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

/** Desktop: the window scrolls, so the click-away area stays on the window, not on the page (the menu is in the nav). */
const webFixed = { position: 'fixed' } as unknown as ViewStyle;
/** Desktop: as wide as its longest item; the nav's avatar box it hangs from is narrow. */
const webWidth = { width: 'max-content' } as unknown as ViewStyle;

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
  // Focused or under the mouse: a rounded translucent highlight inside the menu.
  itemFocused: { backgroundColor: focus.fill },
  itemText: { color: colors.text, fontSize: 14.4 },
  header: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  headerText: { color: colors.strong, fontWeight: '700' },
  chevron: { marginLeft: 'auto', paddingLeft: 16 },
  miniAvatar: { width: 26, height: 26, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: colors.strong, fontWeight: '700', fontSize: fonts.small },
});
