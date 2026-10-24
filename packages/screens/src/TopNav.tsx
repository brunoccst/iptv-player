import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
// Read through the namespace: React Native Web (desktop) has no TVFocusGuideView, and a named import of it fails there.
import * as ReactNative from 'react-native';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { avatarColor, selectActiveProfile, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { ColourDot } from './ui/ColourDot';
import { Gradient } from './ui/Gradient';
import { Icon } from './ui/Icon';
import { focus } from './ui/focus';
import { colors, fonts, radius, useCompact, useNavHeight, useSizes } from './ui/theme';

/** The pages the top nav links to. */
export type NavSection = 'home' | 'series' | 'movies' | 'live' | 'mylist' | 'downloads';

const LINKS: { section: NavSection; label: () => string }[] = [
  { section: 'home', label: () => t('Home') },
  { section: 'series', label: () => t('Series') },
  { section: 'movies', label: () => t('Movies') },
  { section: 'live', label: () => t('Live TV') },
  { section: 'mylist', label: () => t('My List') },
  { section: 'downloads', label: () => t('My Downloads') },
];

/** The current page's link in the nav, for a page that sends Up there itself (`nextFocusUp`). */
let navTarget: ReactNative.View | null = null;
const navTargetListeners = new Set<() => void>();
function setNavTarget(target: ReactNative.View | null) {
  if (navTarget === target) return;
  navTarget = target;
  navTargetListeners.forEach((listener) => listener());
}
const subscribeNavTarget = (listener: () => void) => {
  navTargetListeners.add(listener);
  return () => navTargetListeners.delete(listener);
};
/** TV: Up from the top of a page lands on the current page's link in the nav, not on whatever is nearest. */
export const useNavFocusTarget = (): ReactNative.View | undefined => useSyncExternalStore(subscribeNavTarget, () => navTarget) ?? undefined;

/**
 * The top nav, the same on every app (issue #237, DECISIONS.md#d-208): brand, page links, search box and the account
 * avatar. Transparent over the Home hero until the page scrolls; solid elsewhere. The app keeps the page, the search
 * text and whether the account menu is open; the desktop hangs the menu under the avatar (`menu`), the TV draws it
 * over the whole screen.
 */
export function TopNav({
  section,
  search,
  solid,
  menuOpen,
  onSection,
  onSearch,
  onSubmitSearch,
  onMenu,
  searchRequested,
  onSearchOpened,
  menu,
}: {
  /** The page shown; anything else (Search, the TV's Log) lights no link. */
  section: string;
  search: string;
  solid: boolean;
  menuOpen: boolean;
  onSection(section: NavSection): void;
  /** Typing goes to the Search page; clearing it goes back (D-079). */
  onSearch(text: string): void;
  /** Enter in the search box: search now (TV, D-079). */
  onSubmitSearch?(): void;
  onMenu(open: boolean): void;
  /** TV: the remote's Yellow key asked for the search box (D-154); it starts typing and calls `onSearchOpened`. */
  searchRequested?: boolean;
  onSearchOpened?(): void;
  /** Desktop: the account menu, under the avatar. */
  menu?: ReactNode;
}) {
  const host = useScreenHost();
  const profile = host.hooks.useSession(selectActiveProfile);
  const sizes = useSizes();
  const compact = useCompact();
  const height = useNavHeight();
  const web = Platform.OS === 'web';

  // Desktop: the focus goes back to the avatar when the menu closes (Escape, a pick, a click beside it).
  const avatar = useRef<ReactNative.View>(null);
  const wasOpen = useRef(menuOpen);
  useEffect(() => {
    if (web && wasOpen.current && !menuOpen) (avatar.current as unknown as HTMLElement | null)?.focus();
    wasOpen.current = menuOpen;
  }, [menuOpen, web]);

  // Plain text, not a link: "Home" already goes home, and the remote no longer stops on the name (D-094).
  const brand = (
    <Text testID="nav-brand" style={[styles.brand, { fontSize: sizes.brand }]}>
      {host.signIn.appName}
    </Text>
  );
  const links = LINKS.map((link) => (
    <NavPressable
      key={link.section}
      label={link.label()}
      testID={`nav-${link.section}`}
      selected={section === link.section}
      onPress={() => onSection(link.section)}
    >
      {(focused) => (
        <>
          <Text style={[styles.link, section === link.section && styles.linkActive, focused && styles.linkFocused]}>{link.label()}</Text>
          {/* The remote's Blue key opens Live TV (D-154). */}
          {link.section === 'live' ? <ColourDot colour="blue" style={styles.dot} /> : null}
        </>
      )}
    </NavPressable>
  ));
  const right = (
    <View style={styles.right}>
      <SearchBox
        value={search}
        width={compact ? 130 : sizes.search}
        onChange={onSearch}
        onSubmit={onSubmitSearch}
        requested={!!searchRequested}
        onOpened={onSearchOpened}
      />
      <View>
        <NavPressable
          ref={avatar}
          label={t('Account menu')}
          testID="nav-account"
          plain
          selected={menuOpen}
          onPress={() => onMenu(!menuOpen)}
        >
          {(focused) => (
            <View style={[styles.avatar, { backgroundColor: profile ? avatarColor(profile) : '#555' }, focused && styles.avatarFocused]}>
              <Text style={styles.avatarText}>{profile?.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </NavPressable>
        {menu}
      </View>
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
  // Desktop: a landmark named "Main" around the links, and the bar stays at the top while the window scrolls.
  const linkRow = (style: ViewStyle[]) => (
    <View style={style} {...(web ? { role: 'navigation' as const, accessibilityLabel: t('Main') } : {})}>
      {links}
    </View>
  );
  const bar = [styles.nav, web && webFixed, { height, paddingHorizontal: sizes.gutter }, solid && styles.solid];
  const header = web ? ({ role: 'banner' } as const) : ({ accessibilityRole: 'header' } as const);

  // Web `@media (max-width: 720px)`: brand, search and account on the first row; page links scroll sideways below.
  if (compact) {
    return (
      <View style={[...bar, styles.navCompact]} {...header} testID="top-nav">
        {shade}
        <View style={styles.firstRow}>
          {brand}
          {right}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.linkScroll}>
          {linkRow([styles.links, { gap: sizes.navLinkGap }])}
        </ScrollView>
      </View>
    );
  }

  // Left/right stay in the nav row: at the brand or the avatar they stop instead of jumping to the page below.
  // Up/down leave the row as before.
  const { TVFocusGuideView } = ReactNative;
  const Row = TVFocusGuideView ?? View;
  return (
    <Row
      {...(web ? {} : { trapFocusLeft: true, trapFocusRight: true })}
      style={[...bar, { gap: sizes.navGap }]}
      {...header}
      testID="top-nav"
    >
      {shade}
      {brand}
      {linkRow([styles.links, { gap: sizes.navLinkGap }])}
      {right}
    </Row>
  );
}

/**
 * Search box. On TV the D-pad focuses the box like a button and OK starts typing: a text field that takes D-pad focus
 * directly let Left/Right slip out of the nav row (Android hands arrow keys to the text cursor, then to the nearest
 * view anywhere). Phones and the desktop type in it directly.
 */
function SearchBox({
  value,
  width,
  onChange,
  onSubmit,
  requested,
  onOpened,
}: {
  value: string;
  width: number;
  onChange(text: string): void;
  onSubmit?(): void;
  requested: boolean;
  onOpened?(): void;
}) {
  const tv = Platform.isTV;
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  // The remote's Yellow key (D-154).
  useEffect(() => {
    if (!requested) return;
    onOpened?.();
    setEditing(true);
  }, [requested, onOpened]);

  const field = (
    <TextInput
      ref={input}
      testID="nav-search"
      accessibilityLabel={t('Search')}
      style={[styles.searchInput, Platform.OS === 'web' && webNoOutline]}
      placeholder={t('Titles, series')}
      placeholderTextColor="#8c8c8c"
      value={value}
      // TV: only while typing, so the D-pad never lands in the text field itself.
      focusable={!tv || editing}
      onChangeText={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setEditing(false);
      }}
      returnKeyType="search"
      onSubmitEditing={() => onSubmit?.()}
      autoCorrect={false}
    />
  );

  if (!tv) {
    return (
      <View style={[styles.search, { width }, focused && styles.searchFocused]}>
        {field}
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Clear search')}
            testID="nav-search-clear"
            onPress={() => onChange('')}
          >
            <Icon name="close" size={16} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
    );
  }
  // TV: the clear button sits next to the box, as its own stop for the remote (Right from the box). Inside the box it
  // could not get the focus (D-094).
  return (
    <View style={styles.tvSearch}>
      <Pressable
        testID="nav-search-box"
        accessibilityRole="search"
        accessibilityLabel={value ? t('Search: {value}', { value }) : t('Search')}
        onPress={() => setEditing(true)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.search, { width }, focused && styles.searchFocused]}
      >
        {field}
        {/* The remote's Yellow key starts typing here (D-154). */}
        <ColourDot colour="yellow" style={styles.dot} />
      </Pressable>
      {value ? <TvClearButton onPress={() => onChange('')} /> : null}
    </View>
  );
}

function TvClearButton({ onPress }: { onPress(): void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Clear search')}
      testID="nav-search-clear"
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.clear, focused && styles.clearFocused]}
    >
      <Icon name="close" size={18} color={focused ? '#000' : colors.text} />
    </Pressable>
  );
}

function NavPressable({
  ref,
  label,
  testID,
  selected,
  plain,
  onPress,
  children,
}: {
  ref?: React.Ref<ReactNative.View>;
  label: string;
  testID: string;
  selected?: boolean;
  /** No pill (the avatar shows focus itself). */
  plain?: boolean;
  onPress(): void;
  children(focused: boolean): ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const self = useRef<ReactNative.View>(null);
  // The current page's link is where Up from the page goes (useNavFocusTarget). The avatar is "selected" while the
  // menu is open, but it is not a page link.
  const pageLink = selected && !plain;
  useEffect(() => {
    if (!pageLink) return;
    const link = self.current;
    setNavTarget(link);
    return () => {
      if (navTarget === link) setNavTarget(null);
    };
  }, [pageLink]);
  return (
    <Pressable
      ref={(node) => {
        self.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      // Desktop: the page's link is the current page for screen readers, the avatar says its menu is open.
      {...(Platform.OS === 'web'
        ? plain
          ? { 'aria-haspopup': 'menu', 'aria-expanded': !!selected }
          : { 'aria-current': selected ? 'page' : undefined }
        : {})}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setFocused(true)}
      onHoverOut={() => setFocused(false)}
      style={[styles.pressable, plain ? styles.pressablePlain : focused && styles.pressableFocused]}
    >
      {children(focused)}
    </Pressable>
  );
}

/** Desktop: the window scrolls under the bar. */
const webFixed = { position: 'fixed' } as unknown as ViewStyle;
/** Desktop: the box shows the focus itself, not the browser's ring around the text. */
const webNoOutline = { outlineStyle: 'none' } as unknown as ViewStyle;

const styles = StyleSheet.create({
  dot: { top: 2, right: 2 },
  tvSearch: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearFocused: { backgroundColor: focus.solid, borderColor: focus.solid, ...focus.glow },
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
  // Only as tall as the links, so both rows sit in the middle of the bar.
  linkScroll: { flexGrow: 0 },
  solid: { backgroundColor: colors.bg },
  brand: { color: colors.accent, fontWeight: '900', letterSpacing: -0.5 },
  links: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  // The pill reaches into the gap between links, so the text stays where it was.
  pressable: { borderRadius: focus.pill, paddingHorizontal: 10, marginHorizontal: -10 },
  pressablePlain: { paddingHorizontal: 0, marginHorizontal: 0 },
  // Focused (or under the mouse): a translucent pill behind the link (the avatar grows and glows instead).
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
  // No glow (elevation) here: switching it on made React Native rebuild the box's contents on phones, which detached
  // the text field as it got focus; Android then focused the first card and typing went nowhere (D-069).
  searchFocused: { borderColor: focus.ring, backgroundColor: 'rgba(40,40,40,0.9)' },
  searchInput: { flex: 1, minWidth: 0, color: colors.strong, fontSize: fonts.body, paddingVertical: 4 },
  avatar: { width: 34, height: 34, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  avatarFocused: { transform: [{ scale: 1.12 }], ...focus.glow },
  avatarText: { color: colors.strong, fontWeight: '700', fontSize: fonts.body },
});
