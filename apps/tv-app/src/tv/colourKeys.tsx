import { useEffect } from 'react';
import { continueWatching, type LibrarySection, type MasterCard, toggleFavoriteChannel, type FavoriteChannel } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { currentRoute, playFromContinue } from '../navigation/navStore';
import { useRemote } from '../tv/remote';

/**
 * The remote's colour keys (D-154, issue #180): one meaning each, wherever you are.
 * - Red: add the focused title (a card, the details page, the title playing) to My List, or remove it.
 *   On Live TV: add/remove the focused channel to/from favorites.
 * - Green: the player's audio and subtitles; elsewhere plays Continue Watching's first title.
 * - Yellow: Search, from anywhere.
 * - Blue: live, the guide over the channel; elsewhere Live TV.
 * Remotes without them (the Google TV voice remote) reach all of these the usual way.
 */
// The dot and the key colours moved to the screens shared with the desktop app (DECISIONS.md#d-198).
import { isColourKey } from '@iptv/screens/src/ui/ColourDot';
export { COLOUR_KEY_COLOURS, ColourDot, isColourKey, type ColourKey } from '@iptv/screens/src/ui/ColourDot';

export interface ColourTitle {
  section: LibrarySection;
  card: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}

/** A live channel focused in the Live TV guide, for the Red key. */
export interface LiveChannelFocus {
  channel: FavoriteChannel;
}

// The title Red adds: the focused card first, else the page's own title (the details page).
let focused: ColourTitle | null = null;
let page: ColourTitle | null = null;
// The live channel focused in the guide (for Red on Live TV).
let focusedLiveChannel: LiveChannelFocus | null = null;

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

/** Focus a live channel for the Red key on Live TV. */
export function focusLiveChannel(channel: LiveChannelFocus) {
  focusedLiveChannel = channel;
}
/** Blur a live channel. */
export function blurLiveChannel(id: string) {
  if (focusedLiveChannel?.channel.id === id) focusedLiveChannel = null;
}
/** Get the currently focused live channel, if any. */
export const focusedLive = (): LiveChannelFocus | null => focusedLiveChannel;

/** Red on a title: add it to My List or take it off. */
export function toggleOnMyList(title: ColourTitle | null) {
  if (title) void stores.watchlist.getState().toggle(title.section, title.card);
}

/** Red on a live channel: add it to favorites or remove it. */
export function toggleFavoriteLiveChannel(channel: LiveChannelFocus | null) {
  if (!channel) return;
  const profileId = stores.session.getState().activeProfileId;
  if (!profileId) return;
  const prefs = stores.profilePrefs.getState();
  const current = prefs.prefs[profileId]?.favoriteChannels ?? [];
  const updated = toggleFavoriteChannel(current, channel.channel);
  void prefs.update(profileId, { favoriteChannels: updated });
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
    const route = currentRoute(nav);
    // On Live TV section, Red toggles favorite channel; elsewhere Red toggles My List
    if (key === 'red') {
      if (route.name === 'section' && route.section === 'live') {
        toggleFavoriteLiveChannel(focusedLive());
      } else {
        toggleOnMyList(colourTitle());
      }
    } else if (key === 'green') {
      const first = continueWatching(stores.progress.getState().items.data ?? [])[0];
      if (first) playFromContinue(navStore, first);
    } else nav.goSection('live');
  });
  return null;
}
