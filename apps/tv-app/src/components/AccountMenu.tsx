import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { avatarColor, needsPinToOpen, selectActiveProfile } from '@iptv/shared';
import { navStore, signOut, stores, updater } from '../appContext';
import { appConfig, updateRepo } from '../config';
import { useNav, usePin, useSession } from '../hooks';
import { colors, fonts, radius, useNavHeight, useSizes } from '../theme';
import { TvMedia } from '../../modules/tv-media';
import { BackupDialog } from './BackupDialog';
import { LanguageSettings } from './LanguageSettings';
import { PlaybackSettings } from './PlaybackSettings';
import { Icon, type IconName } from './Icon';
import { usePinGate } from './PinPad';
import { PinSettings } from './PinSettings';
import { pairingDialog } from '../pairing/PairingDialogs';

/** Asks first: signing out needs the provider password again and removes this account's downloads (D-050). */
export function confirmSignOut() {
  Alert.alert('Sign out?', 'You will need your provider login to sign in again. Downloads on this device are deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
  ]);
}

/** Account menu under the nav avatar, same items as the web (plus Log, for sharing diagnostics). */
export function AccountMenu() {
  const open = useNav((s) => s.menuOpen);
  const profile = useSession(selectActiveProfile);
  const profiles = useSession((s) => s.profiles);
  const pinStatus = usePin((s) => s.status);
  const { gate, dialog } = usePinGate();
  const [pinSettings, setPinSettings] = useState(false);
  const [backup, setBackup] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [language, setLanguage] = useState(false);
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
    </>
  );
  if (!open) return overlays;

  const close = () => navStore.getState().setMenuOpen(false);
  const others = profiles.filter((p) => p.id !== profile?.id);
  return (
    <>
      {overlays}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close menu" focusable={false} />
      <View style={[styles.menu, { right: sizes.gutter, top: navH - 8 }]} accessibilityRole="menu" testID="account-menu">
        {others.map((p, index) => (
          <MenuItem
            key={p.id}
            label={p.name}
            testID={`menu-profile-${p.id}`}
            first={index === 0}
            avatar={avatarColor(p)}
            onPress={() => {
              close();
              // Leaving a Kids profile for a regular one needs the parental PIN when one is set (D-054).
              gate(needsPinToOpen(pinStatus, profile, p), `Enter the parental PIN to open ${p.name}`, () => {
                stores.session.getState().selectProfile(p.id);
                navStore.getState().goSection('home');
              });
            }}
          />
        ))}
        <MenuItem
          icon="pencil"
          label="Manage Profiles"
          testID="menu-profiles"
          first={others.length === 0}
          onPress={() => {
            close();
            stores.session.getState().selectProfile(null);
          }}
        />
        <MenuItem
          icon="lock"
          label="Parental PIN"
          testID="menu-pin"
          onPress={() => {
            close();
            setPinSettings(true);
          }}
        />
        {/* Phone-to-TV sign-in and sync (D-060): the TV shows a code, the phone scans it. */}
        <MenuItem
          icon={Platform.isTV ? 'phone' : 'tv'}
          label={Platform.isTV ? 'Sync with phone' : 'Connect a TV'}
          testID="menu-pairing"
          onPress={() => {
            close();
            pairingDialog.setState({ open: true });
          }}
        />
        <MenuItem
          icon="subtitles"
          label="Languages"
          testID="menu-language"
          onPress={() => {
            close();
            setLanguage(true);
          }}
        />
        <MenuItem
          icon="backup"
          label="Back up data"
          testID="menu-backup"
          onPress={() => {
            close();
            setBackup(true);
          }}
        />
        {/* Only builds with the FFmpeg audio decoders have something to choose (D-059). */}
        {TvMedia.ffmpegAudioAvailable() ? (
          <MenuItem
            icon="subtitles"
            label="Playback"
            testID="menu-playback"
            onPress={() => {
              close();
              setPlayback(true);
            }}
          />
        ) : null}
        <MenuItem
          icon="refresh"
          label="Refresh library"
          testID="menu-refresh"
          onPress={() => {
            close();
            void stores.library.getState().sync();
          }}
        />
        {/* Builds from the GitHub release can update themselves (D-062). */}
        {updateRepo ? (
          <MenuItem
            icon="download"
            label="Check for updates"
            testID="menu-update"
            onPress={() => {
              close();
              updater.open();
              void updater.check();
            }}
          />
        ) : null}
        <MenuItem icon="info" label="Log" testID="menu-log" onPress={() => navStore.getState().goSection('log')} />
        <MenuItem
          icon="logout"
          label={`Sign out of ${appConfig.appName}`}
          testID="menu-sign-out"
          onPress={() => {
            close();
            confirmSignOut();
          }}
        />
      </View>
    </>
  );
}

function MenuItem({
  label,
  icon,
  avatar,
  first,
  testID,
  onPress,
}: {
  label: string;
  icon?: IconName;
  avatar?: string;
  first?: boolean;
  testID: string;
  onPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      hasTVPreferredFocus={first}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.item, focused && styles.itemFocused]}
    >
      {avatar ? (
        <View style={[styles.miniAvatar, { backgroundColor: avatar }]}>
          <Text style={styles.miniAvatarText}>{label.charAt(0)}</Text>
        </View>
      ) : icon ? (
        <Icon name={icon} size={18} color={colors.text} />
      ) : null}
      <Text style={styles.itemText}>{label}</Text>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  itemFocused: { backgroundColor: colors.raised },
  itemText: { color: colors.text, fontSize: 14.4 },
  miniAvatar: { width: 26, height: 26, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: colors.strong, fontWeight: '700', fontSize: fonts.small },
});
