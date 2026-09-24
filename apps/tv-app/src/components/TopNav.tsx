import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { avatarColor, selectActiveProfile } from '@iptv/shared';
import { navStore } from '../appContext';
import { appConfig } from '../config';
import { useNav, useSession } from '../hooks';
import { currentSection, type Section } from '../navigation/navStore';
import { colors, fonts, navHeight, radius, useSizes } from '../theme';
import { Gradient } from './Gradient';
import { Icon } from './Icon';

const LINKS: { section: Section; label: string }[] = [
  { section: 'home', label: 'Home' },
  { section: 'series', label: 'Series' },
  { section: 'movies', label: 'Movies' },
  { section: 'live', label: 'Live TV' },
  { section: 'downloads', label: 'My Downloads' },
];

/**
 * Top navigation, same as the web `TopNav`: brand, page links, search box, account avatar (opens `AccountMenu`).
 * Transparent over the Home hero until the page scrolls; solid elsewhere.
 */
export function TopNav() {
  const section = useNav(currentSection);
  const search = useNav((s) => s.search);
  const scrolled = useNav((s) => s.scrolled);
  const menuOpen = useNav((s) => s.menuOpen);
  const profile = useSession(selectActiveProfile);
  const sizes = useSizes();
  const solid = scrolled || section !== 'home';

  return (
    <View
      style={[styles.nav, { paddingHorizontal: sizes.gutter, gap: sizes.navGap }, solid && styles.solid]}
      accessibilityRole="header"
      testID="top-nav"
    >
      {solid ? null : (
        <Gradient
          stops={[
            { offset: 0, color: '#000', opacity: 0.75 },
            { offset: 1, color: '#000', opacity: 0 },
          ]}
        />
      )}
      <NavPressable onPress={() => navStore.getState().goSection('home')} testID="nav-brand" label={appConfig.appName}>
        {() => <Text style={[styles.brand, { fontSize: sizes.brand }]}>{appConfig.appName}</Text>}
      </NavPressable>
      <View style={[styles.links, { gap: sizes.navLinkGap }]}>
        {LINKS.map((link) => (
          <NavPressable
            key={link.section}
            label={link.label}
            testID={`nav-${link.section}`}
            selected={section === link.section}
            onPress={() => navStore.getState().goSection(link.section)}
          >
            {(focused) => (
              <Text style={[styles.link, section === link.section && styles.linkActive, focused && styles.linkFocused]}>{link.label}</Text>
            )}
          </NavPressable>
        ))}
      </View>
      <View style={styles.right}>
        <SearchBox value={search} width={sizes.search} />
        <NavPressable
          label="Account menu"
          testID="nav-account"
          selected={menuOpen}
          onPress={() => navStore.getState().setMenuOpen(!menuOpen)}
        >
          {(focused) => (
            <View style={[styles.avatar, { backgroundColor: profile ? avatarColor(profile) : '#555' }, focused && styles.avatarFocused]}>
              <Text style={styles.avatarText}>{profile?.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </NavPressable>
      </View>
    </View>
  );
}

function SearchBox({ value, width }: { value: string; width: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, { width }, focused && styles.searchFocused]}>
      <TextInput
        testID="nav-search"
        accessibilityLabel="Search"
        style={styles.searchInput}
        placeholder="Titles, series"
        placeholderTextColor="#8c8c8c"
        value={value}
        onChangeText={(text) => navStore.getState().setSearch(text)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value ? (
        <Pressable accessibilityLabel="Clear search" testID="nav-search-clear" onPress={() => navStore.getState().setSearch('')}>
          <Icon name="close" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

function NavPressable({
  label,
  testID,
  selected,
  onPress,
  children,
}: {
  label: string;
  testID: string;
  selected?: boolean;
  onPress(): void;
  children(focused: boolean): React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.pressable, focused && styles.pressableFocused]}
    >
      {children(focused)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    height: navHeight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  solid: { backgroundColor: colors.bg },
  brand: { color: colors.accent, fontWeight: '900', letterSpacing: -0.5 },
  links: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  pressable: { borderWidth: 2, borderColor: 'transparent', borderRadius: radius + 2, paddingHorizontal: 2 },
  pressableFocused: { borderColor: colors.strong },
  link: { color: colors.text, fontSize: 14.4, paddingVertical: 4 },
  linkActive: { color: colors.strong, fontWeight: '700' },
  linkFocused: { color: colors.strong },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  searchFocused: { borderColor: colors.strong, borderWidth: 2 },
  searchInput: { flex: 1, color: colors.strong, fontSize: fonts.body, paddingVertical: 4 },
  avatar: { width: 34, height: 34, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  avatarFocused: { transform: [{ scale: 1.1 }] },
  avatarText: { color: colors.strong, fontWeight: '700', fontSize: fonts.body },
});
