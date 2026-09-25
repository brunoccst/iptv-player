import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { avatarColor, selectActiveProfile } from '@iptv/shared';
import { navStore, signOut, stores } from '../appContext';
import { appConfig } from '../config';
import { useNav, useSession } from '../hooks';
import { colors, fonts, radius, useNavHeight, useSizes } from '../theme';
import { Icon, type IconName } from './Icon';

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
  const sizes = useSizes();
  const navH = useNavHeight();
  if (!open) return null;

  const close = () => navStore.getState().setMenuOpen(false);
  const others = profiles.filter((p) => p.id !== profile?.id);
  return (
    <>
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
              stores.session.getState().selectProfile(p.id);
              navStore.getState().goSection('home');
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
          icon="refresh"
          label="Refresh library"
          testID="menu-refresh"
          onPress={() => {
            close();
            void stores.library.getState().sync();
          }}
        />
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
