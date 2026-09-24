import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Image, StyleSheet, View } from 'react-native';
import { downloadsStore, navStore, stores } from './appContext';
import { SideRail } from './components/SideRail';
import { useNav, useSession } from './hooks';
import { currentRoute } from './navigation/navStore';
import { useLibraryWatcher } from './useLibraryWatcher';
import { PlayerScreen } from './player/PlayerScreen';
import { BrowseScreen } from './screens/BrowseScreen';
import { CategoryScreen } from './screens/CategoryScreen';
import { DetailsScreen } from './screens/DetailsScreen';
import { DownloadsScreen } from './screens/DownloadsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LiveScreen } from './screens/LiveScreen';
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
      <StatusBar hidden />
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

/** Signed-in layout: side rail + current route. Back pops the stack; at the root Android exits. */
function Shell() {
  const route = useNav(currentRoute);
  const revision = useNav((s) => s.libraryRevision);
  const processing = useLibraryWatcher();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => navStore.getState().back());
    return () => subscription.remove();
  }, []);

  if (route.name === 'player') return <PlayerScreen key={`${route.target.kind}-${route.target.streamId}`} target={route.target} />;

  return (
    <View style={styles.shell}>
      <SideRail />
      <View style={styles.content}>
        {route.name === 'category' ? (
          <CategoryScreen
            key={`${route.section}-${route.categoryId}-${revision}`}
            section={route.section}
            categoryId={route.categoryId}
            title={route.title}
          />
        ) : route.name === 'details' ? (
          <DetailsScreen key={route.masterId} section={route.section} masterId={route.masterId} />
        ) : route.section === 'home' ? (
          <HomeScreen key={`home-${revision}`} processing={processing} />
        ) : route.section === 'movies' || route.section === 'series' ? (
          <BrowseScreen key={`${route.section}-${revision}`} section={route.section} />
        ) : route.section === 'search' ? (
          <SearchScreen />
        ) : route.section === 'log' ? (
          <LogScreen />
        ) : route.section === 'live' ? (
          <LiveScreen />
        ) : (
          <DownloadsScreen />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
  starting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  logo: { width: 200, height: 200 },
});
