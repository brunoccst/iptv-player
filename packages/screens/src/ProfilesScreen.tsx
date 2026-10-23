import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { avatarColor, fluid, type ProfileDto, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { KidsCategories } from './KidsCategories';
import { ErrorText, errorText } from './ui/Feedback';
import { Field } from './ui/Field';
import { focus } from './ui/focus';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { Icon } from './ui/Icon';
import { colors, fonts, radius } from './ui/theme';

/**
 * "Who's watching?" (DECISIONS.md#d-200): pick a profile; Manage Profiles edits, adds or deletes them. One screen for TV,
 * phone and desktop. With a parental PIN, regular profiles and managing ask for it (D-054).
 */
export function ProfilesScreen() {
  const { hooks, profiles: host } = useScreenHost();
  const { gate, dialog } = host.usePinGate();
  const { profiles, managing, editing, canAdd, select, add, toggleManaging, closeEditor } = hooks.useProfilePicker(gate);
  const { width, height } = useWindowDimensions();
  const tile = fluid(width, 90, 10, 150);

  return (
    // Desktop: as tall as the window, so the tiles sit in its middle.
    <ScrollView style={[styles.screen, Platform.OS === 'web' && { height }]} contentContainerStyle={styles.center}>
      <Text accessibilityRole="header" style={[styles.heading, { fontSize: fluid(width, 29, 4, 54) }]}>
        {managing ? t('Manage Profiles') : t("Who's watching?")}
      </Text>
      <FocusRow style={[styles.grid, { gap: fluid(width, 12, 2, 28) }]}>
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
        {canAdd ? <ProfileTile name={t('Add Profile')} size={tile} add onPress={add} /> : null}
      </FocusRow>
      <FocusRow style={styles.actions}>
        <FocusButton
          label={managing ? t('Done') : t('Manage Profiles')}
          variant="ghost"
          onPress={toggleManaging}
          testID="profiles-manage"
        />
        <FocusButton label={t('Sign out')} variant="ghost" onPress={host.signOut} testID="profiles-sign-out" />
      </FocusRow>
      {editing ? <ProfileEditor profile={editing === 'new' ? null : editing} onClose={closeEditor} /> : null}
      {dialog}
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
      testID="profile-tile"
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setFocused(true)}
      onHoverOut={() => setFocused(false)}
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
      {isKids ? <Text style={styles.kids}>{t('Kids')}</Text> : null}
    </Pressable>
  );
}

/** Name, colour, Kids profile; Save or Delete. */
function ProfileEditor({ profile, onClose }: { profile: ProfileDto | null; onClose(): void }) {
  const { hooks, profiles: host } = useScreenHost();
  const { LanguageSettings } = host;
  const {
    busy,
    error,
    name,
    setName,
    isKids,
    setIsKids,
    color,
    setColor,
    colors: avatarColors,
    save,
    remove,
    close,
  } = hooks.useProfileEditor(profile, onClose);
  const [categories, setCategories] = useState(false);
  const [languages, setLanguages] = useState(false);
  // Desktop: Escape closes it, like the app's other dialogs (TV and phone close it with Back). Not while a dialog
  // opened from it is on top: that one closes first.
  const nested = categories || languages;
  useEffect(() => {
    if (Platform.OS !== 'web' || nested) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    // Capture: the name field keeps its key presses to itself.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, nested]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <ScrollView style={styles.scrim} contentContainerStyle={styles.scrimContent}>
        <View style={styles.editor} role="dialog" accessibilityLabel={profile ? t('Edit profile') : t('Add profile')}>
          <Text accessibilityRole="header" style={styles.editorTitle}>
            {profile ? t('Edit Profile') : t('Add Profile')}
          </Text>
          <Field
            label={t('Name')}
            value={name}
            onChange={setName}
            testID="profile-name"
            maxLength={50}
            autoFocus
            onSubmit={() => {
              if (!busy && name.trim()) void save();
            }}
          />
          <Text style={styles.label}>{t('Colour')}</Text>
          <FocusRow style={styles.swatches}>
            {avatarColors.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={t('Colour {option}', { option })}
                aria-checked={option === color}
                onPress={() => setColor(option)}
                style={[styles.swatch, { backgroundColor: option }, option === color && styles.swatchSelected]}
              />
            ))}
          </FocusRow>
          <Pressable
            accessibilityRole="checkbox"
            aria-checked={isKids}
            accessibilityLabel={t('Kids profile')}
            onPress={() => setIsKids(!isKids)}
            style={styles.checkbox}
          >
            <View style={[styles.box, isKids && styles.boxChecked]}>{isKids ? <Icon name="check" size={16} color="#000" /> : null}</View>
            <Text style={styles.checkLabel}>{t('Kids profile')}</Text>
          </Pressable>
          {/* Parents pick what a saved Kids profile may see (D-053); new profiles can do so after the first save. */}
          {isKids && profile ? (
            <FocusButton
              label={t('Choose categories')}
              icon="pencil"
              variant="ghost"
              onPress={() => setCategories(true)}
              testID="profile-categories"
            />
          ) : null}
          {/* Also here, so parents can set a Kids profile's languages: its own menu has no settings. */}
          {profile ? (
            <FocusButton
              label={t('Content language filter')}
              icon="subtitles"
              variant="ghost"
              onPress={() => setLanguages(true)}
              testID="profile-languages"
            />
          ) : null}
          {error ? <ErrorText>{errorText(error)}</ErrorText> : null}
          <FocusRow style={styles.editorActions}>
            <FocusButton
              label={t('Save')}
              variant="primary"
              disabled={busy || !name.trim()}
              onPress={() => void save()}
              testID="profile-save"
            />
            {profile ? (
              <FocusButton label={t('Delete Profile')} icon="trash" variant="ghost" disabled={busy} onPress={() => void remove()} />
            ) : null}
            <FocusButton label={t('Cancel')} variant="ghost" onPress={close} />
          </FocusRow>
        </View>
      </ScrollView>
      {languages && profile ? (
        <LanguageSettings profile={{ id: profile.id, name: name.trim() || profile.name }} onClose={() => setLanguages(false)} />
      ) : null}
      {categories && profile ? (
        <KidsCategories profileId={profile.id} name={name.trim() || profile.name} onClose={() => setCategories(false)} />
      ) : null}
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
  avatarFocused: { borderColor: focus.ring, ...focus.glow },
  initial: { color: colors.strong, fontWeight: '700' },
  name: { color: colors.muted, fontSize: fonts.body },
  nameFocused: { color: colors.strong },
  kids: { color: colors.warning, fontSize: fonts.tiny },
  actions: { flexDirection: 'row', gap: 16 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  scrimContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  editor: { width: 420, maxWidth: '100%', padding: 32, gap: 16, borderRadius: 8, backgroundColor: colors.surface },
  editorTitle: { color: colors.strong, fontSize: 24, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 14 },
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
