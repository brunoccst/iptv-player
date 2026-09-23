import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { stores } from '../appContext';
import { FocusButton } from '../components/FocusButton';
import { useSession } from '../hooks';
import { colors, fonts, spacing } from '../theme';

const PALETTE = ['#e50914', '#1f6feb', '#8250df', '#1a7f37', '#bf8700', '#d63384'];

/** Same colour rule as the web app: `avatarKey` if it is a palette colour, else hashed from the id. */
export function avatarColor(profile: { id: string; avatarKey?: string | null }): string {
  if (profile.avatarKey && PALETTE.includes(profile.avatarKey)) return profile.avatarKey;
  return PALETTE[[...profile.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTE.length]!;
}

/** "Who's watching?". Profiles are created and edited in the web app. */
export function ProfilesScreen() {
  const profiles = useSession((s) => s.profiles);

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Who's watching?</Text>
      <View style={styles.grid}>
        {profiles.map((profile, index) => (
          <ProfileTile
            key={profile.id}
            name={profile.name}
            color={avatarColor(profile)}
            isKids={profile.isKids}
            hasTVPreferredFocus={index === 0}
            onPress={() => stores.session.getState().selectProfile(profile.id)}
          />
        ))}
      </View>
      <FocusButton label="Sign out" variant="ghost" onPress={() => void stores.session.getState().logout()} />
    </View>
  );
}

function ProfileTile({
  name,
  color,
  isKids,
  hasTVPreferredFocus,
  onPress,
}: {
  name: string;
  color: string;
  isKids: boolean;
  hasTVPreferredFocus: boolean;
  onPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.tile, focused && styles.tileFocused]}
    >
      <View style={[styles.avatar, { backgroundColor: color }, focused && styles.avatarFocused]}>
        <Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={[styles.name, focused && styles.nameFocused]}>{name}</Text>
      {isKids ? <Text style={styles.kids}>Kids</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  heading: { color: colors.strong, fontSize: fonts.hero, fontWeight: '500' },
  grid: { flexDirection: 'row', gap: spacing.lg },
  tile: { alignItems: 'center', gap: spacing.sm },
  tileFocused: { transform: [{ scale: 1.1 }] },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarFocused: { borderColor: colors.strong },
  initial: { color: colors.strong, fontSize: 48, fontWeight: '700' },
  name: { color: colors.muted, fontSize: fonts.body },
  nameFocused: { color: colors.strong },
  kids: { color: colors.warning, fontSize: fonts.small },
});
