import { useEffect } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { continueWatching, type LibrarySection, type MasterCard } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { currentRoute, playFromContinue } from '../navigation/navStore';
import { useRemote } from '../tv/remote';

/**
 * The remote's colour keys (D-154, issue #180): one meaning each, wherever you are.
 * - Red: add the focused title (a card, the details page, the title playing) to My List, or remove it.
 * - Green: the player's audio and subtitles; elsewhere plays Continue Watching's first title.
 * - Yellow: Search, from anywhere.
 * - Blue: live, the guide over the channel; elsewhere Live TV.
 * Remotes without them (the Google TV voice remote) reach all of these the usual way.
 */
export type ColourKey = 'red' | 'green' | 'yellow' | 'blue';

export const COLOUR_KEY_COLOURS: Record<ColourKey, string> = {
  red: '#e53935',
  green: '#43a047',
  yellow: '#fdd835',
  blue: '#1e88e5',
};

export const isColourKey = (key: string): key is ColourKey => key in COLOUR_KEY_COLOURS;

export interface ColourTitle {
  section: LibrarySection;
  card: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}

// The title Red adds: the focused card first, else the page's own title (the details page).
let focused: ColourTitle | null = null;
let page: ColourTitle | null = null;

export function focusTitle(title: ColourTitle) {
  focused = title;
}
export function blurTitle(id: string) {
  if (focused?.card.id === id) focused = null;
}
/** The title a page is about (details), for Red while no card has the focus. */
export function useColourPageTitle(title: ColourTitle | null) {
  const section = title?.section;
  const id = title?.card.id;
  useEffect(() => {
    if (!title) return;
    page = title;
    return () => {
      if (page === title) page = null;
    };
    // The same title on every render of its page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, id]);
}
export const colourTitle = (): ColourTitle | null => focused ?? page;

/** Red on a title: add it to My List or take it off. */
export function toggleOnMyList(title: ColourTitle | null) {
  if (title) void stores.watchlist.getState().toggle(title.section, title.card);
}

/**
 * Mounted once by the app: Red, Green and Blue outside the player (the player handles its own), Yellow everywhere.
 * react-native-tvos reports the keys on release only; the normalized press acts.
 */
export function ColourKeys() {
  useRemote(({ key, action }) => {
    if (!isColourKey(key) || action === 'up') return;
    const nav = navStore.getState();
    if (key === 'yellow') {
      nav.openSearch();
      return;
    }
    if (currentRoute(nav).name === 'player') return;
    if (key === 'red') toggleOnMyList(colourTitle());
    else if (key === 'green') {
      const first = continueWatching(stores.progress.getState().items.data ?? [])[0];
      if (first) playFromContinue(navStore, first);
    } else nav.goSection('live');
  });
  return null;
}

/** TV: a small dot in a colour key's colour on the button that key also presses. Nothing on phones. */
export function ColourDot({ colour, style }: { colour: ColourKey; style?: StyleProp<ViewStyle> }) {
  if (!Platform.isTV) return null;
  return (
    <View
      pointerEvents="none"
      testID={`colour-dot-${colour}`}
      style={[styles.dot, { backgroundColor: COLOUR_KEY_COLOURS[colour] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.5)' },
});
