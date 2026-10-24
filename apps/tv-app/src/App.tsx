import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { startStallWatch } from './diagnostics/stallWatch';
import { ActivityIndicator, BackHandler, Dimensions, Image, Platform, StatusBar as SystemBars, StyleSheet, View } from 'react-native';
import { downloadsStore, navStore, stores, updater } from './appContext';
import { AccountMenu } from './components/AccountMenu';
import { createPageFocus, PageFocusContext } from './components/pageFocus';
import { LibraryNotice } from './components/LibraryBanner';
import { QualityUpgradeDialog } from './components/QualityUpgradeDialog';
import { ReminderDialog } from './components/ReminderDialog';
import { ColourKeys } from './tv/colourKeys';
import { TopNav } from './components/TopNav';
import { useNav, useSession } from './hooks';
import { currentRoute, currentSection, type Section } from './navigation/navStore';
import { useLibraryWatcher } from './useLibraryWatcher';
import { PlayerScreen } from './player/PlayerScreen';
import { BrowseScreen } from './screens/BrowseScreen';
import { DetailsScreen } from './screens/DetailsScreen';
import { DownloadsScreen } from './screens/DownloadsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LiveScreen } from './screens/LiveScreen';
import { MyListScreen } from './screens/MyListScreen';
import { LogScreen } from './screens/LogScreen';
import { SearchScreen } from './screens/SearchScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ProfilesScreen } from './screens/ProfilesScreen';
import { PairingDialogHost } from './pairing/PairingDialogs';
import { useOpenWatchNext, useWatchNextLaunch, useWatchNextSync } from './tv/watchNext';
import { useReminderAlarms } from './tv/reminderAlarms';
import { pairedTv, useAutoSync, useRemoteServer } from './pairing/remote';
import { UpdateDialog } from './update/UpdateDialog';
import { colors } from './theme';
import splashIcon from '../assets/splash-icon.png';
import { appLog, t, useAppStore, useUiLanguage } from '@iptv/shared';

const UPDATE_CHECK_DELAY_MS = 15_000;

/** Gate: restore session → login → profile picker → shell. */
export function App() {
  const status = useSession((s) => s.status);
  const activeProfileId = useSession((s) => s.activeProfileId);
  const offline = useSession((s) => s.offline);
  const language = useUiLanguage();
  const playing = useNav((s) => currentRoute(s).name === 'player');
  // Phones show the status bar and start the app below it, so rounded corners and the camera cut-out do not cover
  // the header. The player (and TVs) stay full screen.
  const fullScreen = Platform.isTV || (playing && status === 'authenticated' && !!activeProfileId);
  const topInset = fullScreen ? 0 : (SystemBars.currentHeight ?? 0);
  // TVs play what a paired phone sends (D-061).
  useRemoteServer(Platform.isTV && status === 'authenticated');
  // Phones and tablets keep profiles, progress and My List in step with the paired TV (issue #227).
  const hasTv = useAppStore(pairedTv, (s) => s.tv !== null);
  useAutoSync(!Platform.isTV && status === 'authenticated' && hasTv);
  // The home screen's "Continue watching" row on Android TV and Google TV (issue #165, D-147).
  useWatchNextSync(Platform.isTV);
  useWatchNextLaunch(Platform.isTV);
  // Phone and tablet: guide reminders also notify with the app closed (issue #263, D-222).
  useReminderAlarms(!Platform.isTV);

  useEffect(() => {
    void stores.session.getState().restore();
    if (!Platform.isTV) void pairedTv.getState().load();
    downloadsStore.getState().init();
    // Looks for a newer APK once the app has settled (D-062).
    const updateTimer = setTimeout(() => void updater.check(true), UPDATE_CHECK_DELAY_MS);
    const stopStallWatch = startStallWatch();
    return () => {
      stopStallWatch();
      clearTimeout(updateTimer);
      downloadsStore.getState().dispose();
    };
  }, []);

  useEffect(() => {
    if (offline) navStore.getState().goSection('downloads');
  }, [offline]);

  return (
    // The whole app redraws in a newly chosen language (D-084).
    <View style={styles.root} key={language}>
      <StatusBar hidden={fullScreen} style="light" />
      {/* Phones and tablets never show the navigation bar or taskbar; a swipe from the edge brings it back for a moment
          (DECISIONS.md#d-177). */}
      {Platform.isTV ? null : <NavigationBar hidden />}
      <View style={{ height: topInset }} testID="status-bar-space" />
      <View style={styles.app}>
        {status === 'idle' || status === 'restoring' ? (
          <Starting />
        ) : status === 'anonymous' ? (
          <LoginScreen />
        ) : !activeProfileId ? (
          <ProfilesScreen />
        ) : (
          <>
            <Shell />
            <ColourKeys />
          </>
        )}
      </View>
      <PairingDialogHost />
      <UpdateDialog />
    </View>
  );
}

/**
 * The page on screen. A new page (Movies, Series, …) takes a moment to build on a TV, so the first frame after
 * choosing it shows a spinner (the nav link is already highlighted); the page follows right after.
 */
const HEAVY_PAGES: Section[] = ['home', 'movies', 'series', 'live'];

function useShownSection(section: Section): Section {
  const [shown, setShown] = useState(section);
  // Light pages (search results as you type, lists, the log) switch at once.
  const heavy = HEAVY_PAGES.includes(section);
  useEffect(() => {
    if (shown === section) return;
    if (!heavy) return setShown(section);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setShown(section), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [section, shown, heavy]);
  return heavy ? shown : section;
}

function PageLoading() {
  return (
    <View style={styles.pageLoading} accessibilityLabel={t('Loading page')} testID="page-loading">
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

/** First screen while the saved session loads: same icon as the native launch screen, so start-up looks like one step. */
function Starting() {
  return (
    <View style={styles.starting} accessibilityLabel={t('Starting')}>
      <Image source={splashIcon} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** Signed-in layout, like the web shell: top nav over the current page; details open as a panel over it. */
function Shell() {
  const route = useNav(currentRoute);
  const section = useNav(currentSection);
  const revision = useNav((s) => s.libraryRevision);
  const categoryId = useNav((s) => s.categoryId);
  const processing = useLibraryWatcher();
  const shown = useShownSection(section);
  // A title chosen in the TV home screen's "Continue watching" row plays once its profile is loaded (D-147).
  useOpenWatchNext();

  // The Log screen then shows which page was opened before a stall (D-093).
  useEffect(() => appLog.info('nav', `opened ${section}${categoryId ? ` (category ${categoryId})` : ''}`), [section, categoryId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => navStore.getState().back());
    return () => subscription.remove();
  }, []);

  // TV: closing the details puts the focus back on what opened them, or else on the first cover or button on screen
  // (D-069); Android handed it to any view.
  const pageFocus = useRef(createPageFocus()).current;
  const behind = route.name === 'details';
  const pageFocusContext = useMemo(() => ({ behind, register: pageFocus.register }), [behind, pageFocus]);
  // The page the details opened over; Yellow (search) and Blue (Live TV) close them onto another page, or onto the
  // search box, which keep their own focus.
  const openedOver = useRef<Section | null>(null);
  const searchRequested = useNav((s) => s.searchRequested);
  const menuOpen = useNav((s) => s.menuOpen);
  const updatePrompt = useAppStore(updater.store, (s) => s.prompt);
  useEffect(() => {
    if (route.name === 'details') {
      openedOver.current ??= section;
      return;
    }
    const over = openedOver.current;
    openedOver.current = null;
    if (!Platform.isTV || over !== section || route.name !== 'section' || searchRequested) return;
    // A frame later, so the focus is asked once the panel has left the screen.
    const frame = requestAnimationFrame(() => void pageFocus.restore(Dimensions.get('window')));
    return () => cancelAnimationFrame(frame);
    // Only a change of route closes the details.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  if (route.name === 'player')
    return (
      <>
        <PlayerScreen key={`${route.target.kind}-${route.target.streamId}`} target={route.target} />
        <ReminderDialog />
      </>
    );

  return (
    <View style={styles.shell}>
      <View
        style={styles.content}
        importantForAccessibility={route.name === 'details' ? 'no-hide-descendants' : 'auto'}
        onFocusCapture={Platform.isTV ? pageFocus.focused : undefined}
      >
        {/* Nothing behind the details panel asks for the focus, whatever the page redraws (D-069). */}
        <PageFocusContext.Provider value={pageFocusContext}>
          {shown !== section ? (
            <PageLoading />
          ) : section === 'home' ? (
            <HomeScreen key={`home-${revision}`} processing={processing} />
          ) : section === 'movies' || section === 'series' ? (
            <BrowseScreen key={`${section}-${categoryId}-${revision}`} section={section} processing={processing} />
          ) : section === 'search' ? (
            <SearchScreen />
          ) : section === 'log' ? (
            <LogScreen />
          ) : section === 'live' ? (
            <LiveScreen />
          ) : section === 'mylist' ? (
            <MyListScreen />
          ) : (
            <DownloadsScreen />
          )}
        </PageFocusContext.Provider>
      </View>
      {route.name === 'details' ? null : <TopNav />}
      {route.name === 'details' ? <DetailsScreen key={route.masterId} section={route.section} masterId={route.masterId} /> : null}
      <AccountMenu />
      {route.name === 'details' ? null : <LibraryNotice />}
      {/* Better copies of movies on My List, over Home only (DECISIONS.md#d-176). */}
      <QualityUpgradeDialog visible={route.name === 'section' && section === 'home' && shown === section && !menuOpen && !updatePrompt} />
      <ReminderDialog />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  app: { flex: 1 },
  shell: { flex: 1 },
  content: { flex: 1 },
  starting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  pageLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 200, height: 200 },
});
