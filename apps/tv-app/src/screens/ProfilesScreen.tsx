import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { AVATAR_COLORS, avatarColor, fluid, type ProfileDto } from '@iptv/shared';
import { stores } from '../appContext';
import { confirmSignOut } from '../components/AccountMenu';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { Icon } from '../components/Icon';
import { useSession } from '../hooks';
import { colors, fonts, radius } from '../theme';

export { avatarColor };

const MAX_PROFILES = 5;

/** Same as the web "Who's watching?": pick a profile; Manage Profiles edits, adds or deletes them. */
export function ProfilesScreen() {
  const profiles = useSession((s) => s.profiles);
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<ProfileDto | 'new' | null>(null);
  const { width } = useWindowDimensions();
  const tile = fluid(width, 90, 10, 150);

  const select = (profile: ProfileDto) => (managing ? setEditing(profile) : stores.session.getState().selectProfile(profile.id));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.center}>
      <Text style={[styles.heading, { fontSize: fluid(width, 29, 4, 54) }]}>{managing ? 'Manage Profiles' : "Who's watching?"}</Text>
      <View style={[styles.grid, { gap: fluid(width, 12, 2, 28) }]}>
        {profiles.map((profile, index) => (
          <ProfileTile
            key={profile.id}
            name={profile.name}
            size={tile}
            color={avatarColor(profile)}
            isKids={profile.isKids}
            editing={managing}
            hasTVPreferredFocus={index === 0}
            onPress={() => select(profile)}
          />
        ))}
        {profiles.length < MAX_PROFILES ? <ProfileTile name="Add Profile" size={tile} add onPress={() => setEditing('new')} /> : null}
      </View>
      <View style={styles.actions}>
        <FocusButton
          label={managing ? 'Done' : 'Manage Profiles'}
          variant="ghost"
          onPress={() => setManaging(!managing)}
          testID="profiles-manage"
        />
        <FocusButton label="Sign out" variant="ghost" onPress={confirmSignOut} testID="profiles-sign-out" />
      </View>
      {editing ? <ProfileEditor profile={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </ScrollView>
  );
}

function ProfileTile({
  name,
  size,
  color,
  isKids,
  editing,
  add,
  hasTVPreferredFocus,
  onPress,
}: {
  name: string;
  size: number;
  color?: string;
  isKids?: boolean;
  editing?: boolean;
  add?: boolean;
  hasTVPreferredFocus?: boolean;
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
      style={[styles.tile, { width: size }]}
    >
      <View
        style={[
          styles.avatar,
          { width: size, height: size },
          add ? styles.avatarAdd : { backgroundColor: color },
          focused && styles.avatarFocused,
        ]}
      >
        {add ? (
          <Icon name="plus" size={48} color={colors.muted} />
        ) : editing ? (
          <Icon name="pencil" size={40} />
        ) : (
          <Text style={[styles.initial, { fontSize: Math.round(size * 0.38) }]}>{name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <Text style={[styles.name, focused && styles.nameFocused]}>{name}</Text>
      {isKids ? <Text style={styles.kids}>Kids</Text> : null}
    </Pressable>
  );
}

/** Web `ProfileEditor`: name, colour, Kids profile; Save or Delete. */
function ProfileEditor({ profile, onClose }: { profile: ProfileDto | null; onClose(): void }) {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const [name, setName] = useState(profile?.name ?? '');
  const [isKids, setIsKids] = useState(profile?.isKids ?? false);
  const [color, setColor] = useState(profile ? avatarColor(profile) : AVATAR_COLORS[0]!);
  const session = stores.session.getState();
  const close = () => {
    session.clearError();
    onClose();
  };

  const save = async () => {
    const request = { name: name.trim(), isKids, avatarKey: color };
    const saved = profile ? await session.updateProfile(profile.id, request) : await session.createProfile(request);
    if (saved) onClose();
  };
  const remove = async () => {
    if (profile && (await session.deleteProfile(profile.id))) onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <ScrollView style={styles.scrim} contentContainerStyle={styles.scrimContent}>
        <View style={styles.editor} accessibilityLabel={profile ? 'Edit profile' : 'Add profile'}>
          <Text style={styles.editorTitle}>{profile ? 'Edit Profile' : 'Add Profile'}</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              testID="profile-name"
              accessibilityLabel="Name"
              value={name}
              onChangeText={setName}
              maxLength={50}
              hasTVPreferredFocus
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
          </View>
          <Text style={styles.label}>Colour</Text>
          <View style={styles.swatches}>
            {AVATAR_COLORS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={`Colour ${option}`}
                accessibilityState={{ checked: option === color }}
                onPress={() => setColor(option)}
                style={[styles.swatch, { backgroundColor: option }, option === color && styles.swatchSelected]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isKids }}
            accessibilityLabel="Kids profile"
            onPress={() => setIsKids(!isKids)}
            style={styles.checkbox}
          >
            <View style={[styles.box, isKids && styles.boxChecked]}>{isKids ? <Icon name="check" size={16} color="#000" /> : null}</View>
            <Text style={styles.checkLabel}>Kids profile</Text>
          </Pressable>
          {error ? <ErrorText>{errorText(error)}</ErrorText> : null}
          <View style={styles.editorActions}>
            <FocusButton label="Save" variant="primary" disabled={busy || !name.trim()} onPress={() => void save()} testID="profile-save" />
            {profile ? (
              <FocusButton label="Delete Profile" icon="trash" variant="ghost" disabled={busy} onPress={() => void remove()} />
            ) : null}
            <FocusButton label="Cancel" variant="ghost" onPress={close} />
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  heading: { color: colors.strong, fontWeight: '500', marginBottom: 32, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 },
  tile: { alignItems: 'center', gap: 10 },
  avatar: { borderRadius: radius, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  avatarAdd: { borderColor: colors.muted, backgroundColor: 'transparent' },
  avatarFocused: { borderColor: colors.strong },
  initial: { color: colors.strong, fontWeight: '700' },
  name: { color: colors.muted, fontSize: fonts.body },
  nameFocused: { color: colors.strong },
  kids: { color: colors.warning, fontSize: fonts.tiny },
  actions: { flexDirection: 'row', gap: 16 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  scrimContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  editor: { width: 420, maxWidth: '100%', padding: 32, gap: 16, borderRadius: 8, backgroundColor: colors.surface },
  editorTitle: { color: colors.strong, fontSize: 24, fontWeight: '700' },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 14 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.input,
    color: colors.strong,
    fontSize: fonts.body,
  },
  swatches: { flexDirection: 'row', gap: 8, marginTop: -8 },
  swatch: { width: 36, height: 36, borderRadius: 4, borderWidth: 3, borderColor: 'transparent' },
  swatchSelected: { borderColor: colors.strong },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.strong, borderColor: colors.strong },
  checkLabel: { color: colors.text, fontSize: fonts.body },
  editorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
