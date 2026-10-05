import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { continueWatching, watchlistCard, pageKey, recentChannelTarget, type MasterCard, type ProgressDto, t } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { playFromContinue } from '../navigation/navStore';
import { CardMenu } from '../components/CardMenu';
import { FocusButton } from '../components/FocusButton';
import { Gradient } from '../components/Gradient';
import { RowFocus } from '../components/FocusRow';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { continueMenuItems, useLiveHomeRow, useCatalog, useHeroTitle, useLibrary, useProgress, useWatchlist } from '../hooks';
import { colors, useNavHeight, useSizes } from '../theme';

import { LibraryBanner } from '../components/LibraryBanner';
import { MasterCardItem, TitleRow } from './titles';

/** Movies the hero picks its featured title from. */
const HERO_CANDIDATES = 30;
/** Home rows show only the first items; the arrow card at the end opens the full list. */
const LIVE_ROW_SIZE = 10;
const MOVIE_ROWS = 6;
const SERIES_ROWS = 3;
/**
 * TV: rows built at the start; more follow when the focus or the scroll gets near the last one (D-122). Each row fetches
 * its titles and posters when built: all 13 at once cost a Chromecast about 130 posters before the screen settled.
 */
const TV_FIRST_ROWS = 4;
const TV_ROWS_AHEAD = 2;

/** Same as the web Home: hero, library banner, Continue Watching, Live TV, Series and category rows. */
export function HomeScreen({ processing = false }: { processing?: boolean }) {
  const featured = useLibrary((s) => s.pages[pageKey('movies', { limit: HERO_CANDIDATES })]?.data?.items ?? []);
  // Until the first list answers, the saved library is still being read (seconds for 100k+ titles on a TV, D-117).
  const featuredStatus = useLibrary((s) => s.pages[pageKey('movies', { limit: HERO_CANDIDATES })]?.status ?? 'idle');
  const loading = featured.length === 0 && (featuredStatus === 'idle' || featuredStatus === 'loading');
  const movieCategories = useCatalog((s) => s.categories.movies?.data ?? []);
  const seriesCategories = useCatalog((s) => s.categories.series?.data ?? []);
  const { rowGap } = useSizes();
  const { height: screenHeight } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [shownRows, setShownRows] = useState(TV_FIRST_ROWS);
  // The row below the focused one always exists, so the D-pad can move down into it.
  const showThrough = (index: number) => setShownRows((count) => Math.max(count, index + 1 + TV_ROWS_AHEAD));
  // Where each row sits in the page, so a focused row can be scrolled to the middle of the screen (TV).
  const rowLayouts = useRef(new Map<string, { y: number; height: number }>());
  const centerRow = (key: string) => {
    const layout = rowLayouts.current.get(key);
    if (!layout) return;
    scroll.current?.scrollTo({ y: Math.max(0, layout.y - (screenHeight - layout.height) / 2), animated: true });
  };

  useEffect(() => {
    const { library, catalog } = stores;
    void library.getState().loadPage('movies', { limit: HERO_CANDIDATES });
    void catalog.getState().loadCategories('movies');
    void catalog.getState().loadCategories('series');
  }, []);

  // Phones: virtualized rows (only rows near the screen stay mounted) keep fast scrolling smooth.
  type HomeRow = { key: string; render(): ReactElement };
  const rows: HomeRow[] = [
    { key: 'continue', render: () => <ContinueWatchingRow /> },
    { key: 'mylist', render: () => <MyListRow /> },
    { key: 'live', render: () => <LiveRow /> },
    { key: 'series', render: () => <TitleRow section="series" title={t('Series')} /> },
    ...movieCategories.slice(0, MOVIE_ROWS).map((category) => ({
      key: `m-${category.id}`,
      render: () => <TitleRow section="movies" category={category} title={category.name} />,
    })),
    ...seriesCategories.slice(0, SERIES_ROWS).map((category) => ({
      key: `s-${category.id}`,
      render: () => <TitleRow section="series" category={category} title={t('Series: {name}', { name: category.name })} />,
    })),
  ];

  // Rows start over the bottom of the hero, like the web (`margin-bottom: -6vw`). Without a hero (library still loading
  // on the first start) they start below the nav instead: pulled up, the first row slid under it.
  const hasHero = featured.length > 0;
  const renderRow = (row: HomeRow, index: number) => (
    <View
      key={row.key}
      style={index === 0 ? [styles.rows, { marginTop: hasHero ? -Math.round(rowGap * 2) : Math.round(rowGap / 2) }] : styles.rows}
      onLayout={(event) => rowLayouts.current.set(row.key, event.nativeEvent.layout)}
    >
      <RowFocus.Provider
        value={
          Platform.isTV
            ? () => {
                showThrough(index);
                centerRow(row.key);
              }
            : null
        }
      >
        {row.render()}
      </RowFocus.Provider>
    </View>
  );
  const onScroll = (y: number) => navStore.getState().setScrolled(y > 10);

  // The library notice floats at the bottom, over the rows: under the see-through top nav it was hard to read.
  const banner = <LibraryBanner processing={processing} />;

  // TV: plain ScrollView. The D-pad and swipes never moved the FlatList on the Android TV emulator.
  if (Platform.isTV) {
    return (
      <View style={styles.screen}>
        <ScrollView
          ref={scroll}
          style={styles.screen}
          testID="home-screen"
          scrollEventThrottle={100}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            onScroll(contentOffset.y);
            // Scrolled (a swipe, a mouse wheel) within a screen of the end: the next rows.
            if (contentOffset.y + layoutMeasurement.height >= contentSize.height - layoutMeasurement.height)
              setShownRows((count) => (count < rows.length ? count + TV_ROWS_AHEAD : count));
          }}
        >
          {loading ? <LibraryLoading /> : <Hero candidates={featured} />}
          {rows.slice(0, shownRows).map(renderRow)}
          <View style={styles.bottom} />
        </ScrollView>
        {banner}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.screen}
        testID="home-screen"
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={loading ? <LibraryLoading /> : <Hero candidates={featured} />}
        renderItem={({ item, index }) => renderRow(item, index)}
        ListFooterComponent={<View style={styles.bottom} />}
        // FlatList detaches off-screen children on Android by default; keep them attached (nested horizontal rows).
        removeClippedSubviews={false}
        initialNumToRender={6}
        maxToRenderPerBatch={2}
        windowSize={5}
        scrollEventThrottle={100}
        onScroll={(event) => onScroll(event.nativeEvent.contentOffset.y)}
      />
      {banner}
    </View>
  );
}

const NO_PROGRESS: ProgressDto[] = [];

function ContinueWatchingRow() {
  const items = useProgress((s) => s.items.data) ?? NO_PROGRESS;
  const resume = continueWatching(items);
  // Holding OK on a card opens its options (D-078).
  const [menuFor, setMenuFor] = useState<ProgressDto | null>(null);
  if (resume.length === 0) return null;
  const subtitleOf = (p: ProgressDto) =>
    p.kind === 'episode' && p.seasonNumber != null ? `S${p.seasonNumber}:E${p.episodeNumber ?? '?'}` : null;
  return (
    <>
      <Row
        title={t('Continue Watching')}
        items={resume}
        keyOf={(p) => `${p.kind}-${p.itemId}`}
        testID="row-continue"
        render={(p) => (
          <PosterCard
            title={p.title}
            posterUrl={p.posterUrl}
            progress={p.positionSeconds / p.durationSeconds}
            subtitle={subtitleOf(p)}
            onPress={() => playFromContinue(navStore, p)}
            onLongPress={() => setMenuFor(p)}
          />
        )}
      />
      {menuFor ? (
        <CardMenu
          title={menuFor.title}
          subtitle={subtitleOf(menuFor)}
          onClose={() => setMenuFor(null)}
          actions={continueMenuItems(menuFor, (section, masterId) => navStore.getState().push({ name: 'details', section, masterId })).map(
            (entry) => ({ label: entry.label, testID: `card-menu-${entry.id}`, onPress: entry.run }),
          )}
        />
      ) : null}
    </>
  );
}

/** Saved titles (D-055): the first 10; the title and the arrow card open My List. */
function MyListRow() {
  const items = useWatchlist((s) => s.items.data ?? []);
  if (items.length === 0) return null;
  const open = () => navStore.getState().goSection('mylist');
  return (
    <Row
      title={t('My List')}
      items={items.slice(0, 10)}
      keyOf={(item) => `${item.section}-${item.masterId}`}
      testID="row-mylist"
      onTitlePress={open}
      more={items.length > 10 ? { onPress: open } : undefined}
      render={(item) => <MasterCardItem section={item.section} item={watchlistCard(item)} />}
    />
  );
}

/** The channels the profile watched last; until there are any, the first live category (issue #122, D-129). */
function LiveRow() {
  const row = useLiveHomeRow();
  const { categoryId } = row;
  return (
    <Row
      title={row.title}
      items={row.channels.slice(0, LIVE_ROW_SIZE)}
      keyOf={(c) => c.id}
      empty={t('No channels.')}
      testID="row-live"
      more={
        !row.recent && categoryId && row.channels.length > LIVE_ROW_SIZE
          ? { landscape: true, onPress: () => navStore.getState().openCategory('live', categoryId) }
          : undefined
      }
      render={(c) => (
        <PosterCard
          landscape
          title={c.name}
          posterUrl={c.logoUrl}
          badge={t('LIVE')}
          onPress={() => navStore.getState().push({ name: 'player', target: recentChannelTarget(c) })}
        />
      )}
    />
  );
}

/**
 * Where the hero goes, while the saved library is read after a start (D-117). Android's spinner turns on the UI
 * thread, so it keeps moving even while JavaScript is busy unpacking the library.
 */
function LibraryLoading() {
  const { height } = useWindowDimensions();
  return (
    <View style={[styles.loading, { height: Math.round(height * 0.6) }]} testID="home-loading" accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingText}>{t('Loading your library…')}</Text>
    </View>
  );
}

/** Web `.hero`: featured movie backdrop with the two shades, big title, plot, Play and More Info. */
function Hero({ candidates }: { candidates: MasterCard[] }) {
  const { featured, meta, play, backdrop } = useHeroTitle(candidates);
  const { width, height } = useWindowDimensions();
  const sizes = useSizes();
  const navH = useNavHeight();

  if (!featured) return <View style={{ height: navH }} />;

  const heroHeight = Math.max(420, Math.min(height * 0.8, width * 0.5625));
  return (
    <View style={[styles.hero, { height: heroHeight }]} accessibilityLabel={t('Featured')}>
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <Gradient
        angle={77}
        stops={[
          { offset: 0, color: '#000', opacity: 0.75 },
          { offset: 0.6, color: '#000', opacity: 0 },
        ]}
      />
      <Gradient
        stops={[
          { offset: 0.6, color: colors.bg, opacity: 0 },
          { offset: 1, color: colors.bg },
        ]}
      />
      <View style={[styles.heroContent, { left: sizes.gutter, bottom: heroHeight * 0.3, width: Math.min(560, width * 0.8) }]}>
        <Text style={[styles.heroTitle, { fontSize: sizes.heroTitle }]} numberOfLines={2}>
          {featured.title}
        </Text>
        {meta.data?.plot ? (
          <Text style={[styles.heroPlot, { fontSize: sizes.heroPlot }]} numberOfLines={3}>
            {meta.data.plot}
          </Text>
        ) : null}
        <View style={styles.heroActions}>
          <FocusButton
            label={t('Play')}
            icon="play"
            variant="primary"
            hasTVPreferredFocus
            testID="hero-play"
            disabled={!play}
            onPress={() => play && navStore.getState().push({ name: 'player', target: play })}
          />
          <FocusButton
            label={t('More Info')}
            icon="info"
            variant="secondary"
            testID="hero-info"
            onPress={() => navStore.getState().push({ name: 'details', section: 'movies', masterId: featured.id })}
          />
        </View>
      </View>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  rows: { zIndex: 1 },
  bottom: { height: 60 },
  hero: { overflow: 'hidden' },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: colors.text, fontSize: 18 },
  heroContent: { position: 'absolute' },
  heroTitle: { color: colors.strong, fontWeight: '900', lineHeight: undefined, marginBottom: 12, ...shadow },
  heroPlot: { color: colors.text, marginBottom: 20, ...shadow },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Above everything on the page (rows, focused cards), not focusable.
});

/** Continue Watching card menu: is its title on My List, and add/remove it (D-104). */
