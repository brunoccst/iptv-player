import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Image, Platform, StatusBar as SystemBars, StyleSheet, View } from 'react-native';
import { downloadsStore, navStore, stores } from './appContext';
import { AccountMenu } from './components/AccountMenu';
import { TopNav } from './components/TopNav';
import { useNav, useSession } from './hooks';
import { currentRoute, currentSection } from './navigation/navStore';
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
import { colors } from './theme';
import splashIcon from '../assets/splash-icon.png';

/** Gate: restore session → login → profile picker → shell. */
export function App() {
  const status = useSession((s) => s.status);
  const activeProfileId = useSession((s) => s.activeProfileId);
  const offline = useSession((s) => s.offline);
  const playing = useNav((s) => currentRoute(s).name === 'player');
  // Phones show the status bar and start the app below it, so rounded corners and the camera cut-out do not cover
  // the header. The player (and TVs) stay full screen.
  const fullScreen = Platform.isTV || (playing && status === 'authenticated' && !!activeProfileId);
  const topInset = fullScreen ? 0 : (SystemBars.currentHeight ?? 0);

  useEffect(() => {
    void stores.session.getState().restore();
    downloadsStore.getState().init();
    return () => downloadsStore.getState().dispose();
  }, []);

  useEffect(() => {
    if (offline) navStore.getState().goSection('downloads');
  }, [offline]);

  return (
    <View style={styles.root}>
      <StatusBar hidden={fullScreen} style="light" />
      <View style={{ height: topInset }} testID="status-bar-space" />
      <View style={styles.app}>
        {status === 'idle' || status === 'restoring' ? (
          <Starting />
        ) : status === 'anonymous' ? (
          <LoginScreen />
        ) : !activeProfileId ? (
          <ProfilesScreen />
        ) : (
          <Shell />
        )}
      </View>
    </View>
  );
}

/** First screen while the saved session loads: same icon as the native launch screen, so start-up looks like one step. */
function Starting() {
  return (
    <View style={styles.starting} accessibilityLabel="Starting">
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

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => navStore.getState().back());
    return () => subscription.remove();
  }, []);

  if (route.name === 'player') return <PlayerScreen key={`${route.target.kind}-${route.target.streamId}`} target={route.target} />;

  return (
    <View style={styles.shell}>
      <View style={styles.content} importantForAccessibility={route.name === 'details' ? 'no-hide-descendants' : 'auto'}>
        {section === 'home' ? (
          <HomeScreen key={`home-${revision}`} processing={processing} />
        ) : section === 'movies' || section === 'series' ? (
          <BrowseScreen key={`${section}-${categoryId}-${revision}`} section={section} />
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
      </View>
      {route.name === 'details' ? null : <TopNav />}
      {route.name === 'details' ? <DetailsScreen key={route.masterId} section={route.section} masterId={route.masterId} /> : null}
      <AccountMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  app: { flex: 1 },
  shell: { flex: 1 },
  content: { flex: 1 },
  starting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  logo: { width: 200, height: 200 },
});
