import { useEffect, useMemo, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  continueWatching,
  watchlistCard,
  describeLibraryProgress,
  liveTarget,
  movieTarget,
  pageKey,
  progressTarget,
  selectVariant,
  type MasterCard,
} from '@iptv/shared';
import { api, navStore, stores } from '../appContext';
import { FocusButton } from '../components/FocusButton';
import { Gradient } from '../components/Gradient';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { useCatalog, useLibrary, useProgress, useSession, useWatchlist } from '../hooks';
import { colors, fonts, radius, useNavHeight, useSizes } from '../theme';
import { useAsync } from '../useAsync';
import { MasterCardItem, TitleRow } from './titles';

/** Movies the hero picks its featured title from. */
const HERO_CANDIDATES = 30;
/** Home rows show only the first items; the arrow card at the end opens the full list. */
const LIVE_ROW_SIZE = 10;
const MOVIE_ROWS = 6;
const SERIES_ROWS = 3;

/** Same as the web Home: hero, library banner, Continue Watching, Live TV, Series and category rows. */
export function HomeScreen({ processing = false }: { processing?: boolean }) {
  const featured = useLibrary((s) => s.pages[pageKey('movies', { limit: HERO_CANDIDATES })]?.data?.items ?? []);
  const movieCategories = useCatalog((s) => s.categories.movies?.data ?? []);
  const seriesCategories = useCatalog((s) => s.categories.series?.data ?? []);
  const { rowGap } = useSizes();

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
    { key: 'series', render: () => <TitleRow section="series" title="Series" /> },
    ...movieCategories.slice(0, MOVIE_ROWS).map((category) => ({
      key: `m-${category.id}`,
      render: () => <TitleRow section="movies" category={category} title={category.name} />,
    })),
    ...seriesCategories.slice(0, SERIES_ROWS).map((category) => ({
      key: `s-${category.id}`,
      render: () => <TitleRow section="series" category={category} title={`Series: ${category.name}`} />,
    })),
  ];

  // Rows start over the bottom of the hero, like the web (`margin-bottom: -6vw`). Without a hero (library still loading
  // on the first start) they start below the nav instead: pulled up, the first row slid under it.
  const hasHero = featured.length > 0;
  const renderRow = (row: HomeRow, index: number) => (
    <View
      key={row.key}
      style={index === 0 ? [styles.rows, { marginTop: hasHero ? -Math.round(rowGap * 2) : Math.round(rowGap / 2) }] : styles.rows}
    >
      {row.render()}
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
          style={styles.screen}
          testID="home-screen"
          scrollEventThrottle={100}
          onScroll={(event) => onScroll(event.nativeEvent.contentOffset.y)}
        >
          <Hero candidates={featured} />
          {rows.map(renderRow)}
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
        ListHeaderComponent={<Hero candidates={featured} />}
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

/** Web `.banner`: offline notice or "organizing your library" with per-kind progress (direct mode). */
function LibraryBanner({ processing }: { processing: boolean }) {
  const offline = useSession((s) => s.offline);
  const progress = describeLibraryProgress(useLibrary((s) => s.status.data));
  const { gutter } = useSizes();
  if (!offline && !processing) return null;
  return (
    <View
      style={[styles.banner, { left: gutter, right: gutter }]}
      testID="library-processing"
      accessibilityRole="alert"
      pointerEvents="none"
    >
      {offline ? (
        <Text style={styles.bannerText}>You're offline. Downloaded titles are available in My Downloads.</Text>
      ) : (
        <>
          <View style={styles.bannerLine}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.bannerText}>Organizing your library: grouping duplicate titles and versions…</Text>
          </View>
          {progress.map((line) => (
            <Text key={line} style={styles.bannerDetail}>
              {line}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

function ContinueWatchingRow() {
  const resume = useProgress((s) => continueWatching(s.items.data ?? []));
  if (resume.length === 0) return null;
  return (
    <Row
      title="Continue Watching"
      items={resume}
      keyOf={(p) => `${p.kind}-${p.itemId}`}
      testID="row-continue"
      render={(p) => (
        <PosterCard
          title={p.title}
          posterUrl={p.posterUrl}
          progress={p.positionSeconds / p.durationSeconds}
          subtitle={p.kind === 'episode' && p.seasonNumber != null ? `S${p.seasonNumber}:E${p.episodeNumber ?? '?'}` : null}
          onPress={() => navStore.getState().push({ name: 'player', target: progressTarget(p) })}
        />
      )}
    />
  );
}

/** Saved titles (D-055): the first 10; the title and the arrow card open My List. */
function MyListRow() {
  const items = useWatchlist((s) => s.items.data ?? []);
  if (items.length === 0) return null;
  const open = () => navStore.getState().goSection('mylist');
  return (
    <Row
      title="My List"
      items={items.slice(0, 10)}
      keyOf={(item) => `${item.section}-${item.masterId}`}
      testID="row-mylist"
      onTitlePress={open}
      more={items.length > 10 ? { onPress: open } : undefined}
      render={(item) => <MasterCardItem section={item.section} item={watchlistCard(item)} />}
    />
  );
}

function LiveRow() {
  const categories = useCatalog((s) => s.categories.live?.data ?? []);
  const first = categories[0]?.id ?? null;
  const channels = useCatalog((s) => (first ? (s.liveChannels[first]?.data ?? []) : []));

  useEffect(() => {
    void stores.catalog
      .getState()
      .loadCategories('live')
      .then((loaded) => {
        if (loaded?.[0]) void stores.catalog.getState().loadLiveChannels(loaded[0].id);
      });
  }, []);

  return (
    <Row
      title={categories[0] ? `Live TV: ${categories[0].name}` : 'Live TV'}
      items={channels.slice(0, LIVE_ROW_SIZE)}
      keyOf={(c) => c.id}
      empty="No channels."
      testID="row-live"
      more={
        channels.length > LIVE_ROW_SIZE ? { landscape: true, onPress: () => navStore.getState().openCategory('live', first) } : undefined
      }
      render={(c) => (
        <PosterCard
          landscape
          title={c.name}
          posterUrl={c.logoUrl}
          badge="LIVE"
          onPress={() => navStore.getState().push({ name: 'player', target: liveTarget(c) })}
        />
      )}
    />
  );
}

/** Web `.hero`: featured movie backdrop with the two shades, big title, plot, Play and More Info. */
function Hero({ candidates }: { candidates: MasterCard[] }) {
  const featured = useMemo(() => {
    const withArt = candidates.filter((item) => item.posterUrl);
    return withArt[Math.floor(Math.random() * withArt.length)] ?? candidates[0] ?? null;
  }, [candidates]);
  const { width, height } = useWindowDimensions();
  const sizes = useSizes();
  const navH = useNavHeight();

  useEffect(() => {
    if (featured) void stores.library.getState().loadDetails('movies', featured.id);
  }, [featured]);

  const details = useLibrary((s) => (featured ? (s.details[`movies|${featured.id}`]?.data ?? null) : null));
  const variant = useLibrary((s) => (details ? selectVariant(s, details) : null));
  const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
  if (!featured) return <View style={{ height: navH }} />;

  const heroHeight = Math.max(420, Math.min(height * 0.8, width * 0.5625));
  const backdrop = meta.data?.backdropUrls[0] ?? featured.posterUrl;
  return (
    <View style={[styles.hero, { height: heroHeight }]} accessibilityLabel="Featured">
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
            label="Play"
            icon="play"
            variant="primary"
            hasTVPreferredFocus
            testID="hero-play"
            disabled={!details || !variant}
            onPress={() => details && variant && navStore.getState().push({ name: 'player', target: movieTarget(details, variant) })}
          />
          <FocusButton
            label="More Info"
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
  heroContent: { position: 'absolute' },
  heroTitle: { color: colors.strong, fontWeight: '900', lineHeight: undefined, marginBottom: 12, ...shadow },
  heroPlot: { color: colors.text, marginBottom: 20, ...shadow },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Above everything on the page (rows, focused cards), not focusable.
  banner: {
    position: 'absolute',
    bottom: 16,
    zIndex: 50,
    elevation: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,20,20,0.95)',
    gap: 4,
  },
  bannerLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerText: { color: colors.text, fontSize: 14.4, flexShrink: 1 },
  bannerDetail: { color: colors.muted, fontSize: fonts.small, marginLeft: 32 },
});
