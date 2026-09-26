import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TVFocusGuideView, View } from 'react-native';
import { avatarColor, selectActiveProfile } from '@iptv/shared';
import { navStore } from '../appContext';
import { appConfig } from '../config';
import { useNav, useSession } from '../hooks';
import { currentSection, type Section } from '../navigation/navStore';
import { colors, fonts, radius, useCompact, useNavHeight, useSizes } from '../theme';
import { Gradient } from './Gradient';
import { focus } from './focus';
import { Icon } from './Icon';

const LINKS: { section: Section; label: string }[] = [
  { section: 'home', label: 'Home' },
  { section: 'series', label: 'Series' },
  { section: 'movies', label: 'Movies' },
  { section: 'live', label: 'Live TV' },
  { section: 'mylist', label: 'My List' },
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

  const compact = useCompact();
  const height = useNavHeight();

  const brand = (
    <NavPressable onPress={() => navStore.getState().goSection('home')} testID="nav-brand" label={appConfig.appName}>
      {() => <Text style={[styles.brand, { fontSize: sizes.brand }]}>{appConfig.appName}</Text>}
    </NavPressable>
  );
  const links = LINKS.map((link) => (
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
  ));
  const right = (
    <View style={styles.right}>
      <SearchBox value={search} width={compact ? 130 : sizes.search} />
      <NavPressable
        label="Account menu"
        testID="nav-account"
        plain
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
  );
  const shade = solid ? null : (
    <Gradient
      stops={[
        { offset: 0, color: '#000', opacity: 0.75 },
        { offset: 1, color: '#000', opacity: 0 },
      ]}
    />
  );

  // Web `@media (max-width: 720px)`: brand, search and account on the first row; page links scroll sideways below.
  if (compact) {
    return (
      <View
        style={[styles.nav, styles.navCompact, { height, paddingHorizontal: sizes.gutter }, solid && styles.solid]}
        accessibilityRole="header"
        testID="top-nav"
      >
        {shade}
        <View style={styles.firstRow}>
          {brand}
          {right}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.links, { gap: sizes.navLinkGap }]}>
          {links}
        </ScrollView>
      </View>
    );
  }

  // Left/right stay in the nav row: at the brand or the avatar they stop instead of jumping to the page below.
  // Up/down leave the row as before.
  return (
    <TVFocusGuideView
      trapFocusLeft
      trapFocusRight
      style={[styles.nav, { height, paddingHorizontal: sizes.gutter, gap: sizes.navGap }, solid && styles.solid]}
      accessibilityRole="header"
      testID="top-nav"
    >
      {shade}
      {brand}
      <View style={[styles.links, { gap: sizes.navLinkGap }]}>{links}</View>
      {right}
    </TVFocusGuideView>
  );
}

/**
 * Search box. On TV the D-pad focuses the box like a button and OK starts typing: a text field that takes D-pad focus
 * directly let Left/Right slip out of the nav row (Android hands arrow keys to the text cursor, then to the nearest
 * view anywhere). Phones type in it directly.
 */
function SearchBox({ value, width }: { value: string; width: number }) {
  const tv = Platform.isTV;
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const field = (
    <TextInput
      ref={input}
      testID="nav-search"
      accessibilityLabel="Search"
      style={styles.searchInput}
      placeholder="Titles, series"
      placeholderTextColor="#8c8c8c"
      value={value}
      // TV: only while typing, so the D-pad never lands in the text field itself.
      focusable={!tv || editing}
      onChangeText={(text) => navStore.getState().setSearch(text)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setEditing(false);
      }}
      returnKeyType="search"
      onSubmitEditing={() => navStore.getState().submitSearch()}
      autoCorrect={false}
    />
  );
  const clear = value ? (
    <Pressable accessibilityLabel="Clear search" testID="nav-search-clear" onPress={() => navStore.getState().setSearch('')}>
      <Icon name="close" size={16} />
    </Pressable>
  ) : null;

  if (!tv) {
    return (
      <View style={[styles.search, { width }, focused && styles.searchFocused]}>
        {field}
        {clear}
      </View>
    );
  }
  return (
    <Pressable
      testID="nav-search-box"
      accessibilityRole="search"
      accessibilityLabel={value ? `Search: ${value}` : 'Search'}
      onPress={() => setEditing(true)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.search, { width }, focused && styles.searchFocused]}
    >
      {field}
      {clear}
    </Pressable>
  );
}

function NavPressable({
  label,
  testID,
  selected,
  plain,
  onPress,
  children,
}: {
  label: string;
  testID: string;
  selected?: boolean;
  /** No pill (the avatar shows focus itself). */
  plain?: boolean;
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
      style={[styles.pressable, plain ? styles.pressablePlain : focused && styles.pressableFocused]}
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  navCompact: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: 8 },
  firstRow: { flexDirection: 'row', alignItems: 'center' },
  solid: { backgroundColor: colors.bg },
  brand: { color: colors.accent, fontWeight: '900', letterSpacing: -0.5 },
  links: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  // The pill reaches into the gap between links, so the text stays where it was.
  pressable: { borderRadius: focus.pill, paddingHorizontal: 10, marginHorizontal: -10 },
  pressablePlain: { paddingHorizontal: 0, marginHorizontal: 0 },
  // Focused: a translucent pill behind the link (the avatar grows and glows instead).
  pressableFocused: { backgroundColor: focus.fill },
  link: { color: colors.text, fontSize: 14.4, paddingVertical: 6 },
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
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  searchFocused: { borderColor: focus.ring, backgroundColor: 'rgba(40,40,40,0.9)', ...focus.glow },
  searchInput: { flex: 1, color: colors.strong, fontSize: fonts.body, paddingVertical: 4 },
  avatar: { width: 34, height: 34, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  avatarFocused: { transform: [{ scale: 1.12 }], ...focus.glow },
  avatarText: { color: colors.strong, fontWeight: '700', fontSize: fonts.body },
});
