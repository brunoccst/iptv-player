import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  continueWatching,
  DEFAULT_LIBRARY_SORT,
  pageKey,
  progressDetails,
  progressTarget,
  recentChannelTarget,
  t,
  TOP_RATED_POOL,
  topRated,
  watchlistCard,
  type LibrarySection,
  type MasterCard,
  type MediaCategory,
  type ProgressDto,
} from '@iptv/shared';
import { TitleMenu } from './CardMenu';
import { useScreenHost } from './host';
import { TitleCard } from './TitleCard';
import { FocusButton } from './ui/FocusButton';
import { FocusRow, RowFocus } from './ui/FocusRow';
import { Gradient } from './ui/Gradient';
import { PosterCard } from './ui/PosterCard';
import { Row } from './ui/Row';
import { colors, useNavHeight, useSizes } from './ui/theme';
import { Trailer } from './ui/Trailer';

const WEB = Platform.OS === 'web';
/** Movies the hero picks its featured title from. */
const HERO_CANDIDATES = 30;
/** Home rows show only the first titles; the "See all" card at the end opens the full list. */
const ROW_SIZE = WEB ? 30 : 10;
const MOVIE_ROWS = 6;
const SERIES_ROWS = 3;
/**
 * TV and desktop: rows built at the start; more follow when the focus or the scroll gets near the last one (D-040). Each
 * row fetches its titles and posters when built: all 13 at once cost a Chromecast about 130 posters before the screen
 * settled.
 */
const FIRST_ROWS = 4;
const ROWS_AHEAD = 2;

/**
 * Home (DECISIONS.md#d-197): featured movie, Continue Watching, My List, Live TV, Top rated, Series and category rows.
 * One screen for TV, phone and desktop. `banner`: the library's progress or notice above the rows (desktop);
 * `overlay`: anything the app lays over the page (the TV's library banner).
 */
export function HomeScreen({ banner, overlay }: { banner?: ReactNode; overlay?: ReactNode }) {
  const { hooks, stores, setScrolled, EndSensor } = useScreenHost();
  const featured = hooks.useLibrary((s) => s.pages[pageKey('movies', { limit: HERO_CANDIDATES })]?.data?.items ?? NO_TITLES);
  // Until the first list answers, the saved library is still being read (seconds for 100k+ titles on a TV, D-119).
  const featuredStatus = hooks.useLibrary((s) => s.pages[pageKey('movies', { limit: HERO_CANDIDATES })]?.status ?? 'idle');
  const loading = featured.length === 0 && (featuredStatus === 'idle' || featuredStatus === 'loading');
  const movieCategories = hooks.useCatalog((s) => s.categories.movies?.data ?? NO_CATEGORIES);
  const seriesCategories = hooks.useCatalog((s) => s.categories.series?.data ?? NO_CATEGORIES);
  const { rowGap } = useSizes();
  const { height: screenHeight } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [shownRows, setShownRows] = useState(FIRST_ROWS);
  // The row below the focused one always exists, so the D-pad can move down into it.
  const showThrough = (index: number) => setShownRows((count) => Math.max(count, index + 1 + ROWS_AHEAD));
  // Where each row sits in the page, so a focused row can be scrolled to the middle of the screen (TV).
  const rowLayouts = useRef(new Map<string, { y: number; height: number }>());
  const centerRow = (key: string) => {
    const layout = rowLayouts.current.get(key);
    if (!layout) return;
    scroll.current?.scrollTo({ y: Math.max(0, layout.y - (screenHeight - layout.height) / 2), animated: true });
  };

  useEffect(() => {
    void stores.library.getState().loadPage('movies', { limit: HERO_CANDIDATES });
    void stores.catalog.getState().loadCategories('movies');
    void stores.catalog.getState().loadCategories('series');
  }, [stores]);

  type HomeRow = { key: string; render(): ReactElement };
  const rows: HomeRow[] = [
    { key: 'continue', render: () => <ContinueWatchingRow /> },
    { key: 'mylist', render: () => <MyListRow /> },
    { key: 'live', render: () => <LiveRow /> },
    // The best-rated titles added last (D-040, issue #181, #188).
    {
      key: 'top-movies',
      render: () => <TopRatedRow section="movies" title={t('Top rated of the {count} newest movies', { count: TOP_RATED_POOL })} />,
    },
    {
      key: 'top-series',
      render: () => <TopRatedRow section="series" title={t('Top rated of the {count} newest series', { count: TOP_RATED_POOL })} />,
    },
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

  // Rows start over the bottom of the hero. Without a hero (library still loading on the first start) they start below
  // the nav instead: pulled up, the first row slid under it.
  const hasHero = featured.length > 0;
  const firstRow = [styles.rows, { marginTop: hasHero ? -Math.round(rowGap * 2) : Math.round(rowGap / 2) }];
  const renderRow = (row: HomeRow, index: number) => (
    <View
      key={row.key}
      // Desktop: the banner comes first, so the block of rows moves up instead.
      style={index === 0 && !WEB ? firstRow : styles.rows}
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
  const onScroll = (y: number) => setScrolled?.(y > 10);

  // Desktop: the window scrolls; the next rows come as the end of the page nears the screen.
  if (WEB) {
    return (
      <View testID="home-screen">
        {loading ? <LibraryLoading /> : <Hero candidates={featured} />}
        <View style={firstRow}>
          {banner}
          {rows.slice(0, shownRows).map(renderRow)}
        </View>
        {EndSensor && shownRows < rows.length ? (
          // A new sensor for each step: it reports only coming into view, and may still be in view after a step.
          <EndSensor key={shownRows} onReached={() => setShownRows((count) => count + ROWS_AHEAD)} />
        ) : null}
        <View style={styles.bottom} />
      </View>
    );
  }

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
              setShownRows((count) => (count < rows.length ? count + ROWS_AHEAD : count));
          }}
        >
          {loading ? (
            <LibraryLoading />
          ) : (
            // Up from the first row lands on Play: show the whole banner, Android left it scrolled off (D-069).
            <Hero candidates={featured} onFocus={() => scroll.current?.scrollTo({ y: 0, animated: true })} />
          )}
          {banner}
          {rows.slice(0, shownRows).map(renderRow)}
          <View style={styles.bottom} />
        </ScrollView>
        {overlay}
      </View>
    );
  }

  // Phones: virtualized rows (only rows near the screen stay mounted) keep fast scrolling smooth.
  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.screen}
        testID="home-screen"
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={
          <>
            {loading ? <LibraryLoading /> : <Hero candidates={featured} />}
            {banner}
          </>
        }
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
      {overlay}
    </View>
  );
}

const NO_TITLES: MasterCard[] = [];
const NO_CATEGORIES: MediaCategory[] = [];
const NO_PROGRESS: ProgressDto[] = [];

const episodeLabel = (p: ProgressDto) =>
  p.kind === 'episode' && p.seasonNumber != null ? `S${p.seasonNumber}:E${p.episodeNumber ?? '?'}` : null;

/** Started titles; holding OK (a right-click on desktop) opens a card's options (D-078). */
function ContinueWatchingRow() {
  const { hooks, openDetails, play } = useScreenHost();
  const items = hooks.useProgress((s) => s.items.data) ?? NO_PROGRESS;
  const resume = continueWatching(items);
  if (resume.length === 0) return null;
  // Played over its details, so Back from the player lands there (issue #166).
  const resumeEntry = (p: ProgressDto) => {
    const details = progressDetails(p);
    if (details) openDetails(details.section, details.masterId);
    play(progressTarget(p));
  };
  return (
    <Row
      title={t('Continue Watching')}
      items={resume}
      keyOf={(p) => `${p.kind}-${p.itemId}`}
      testID="row-continue"
      render={(p) => (
        <TitleMenu title={p.title} subtitle={episodeLabel(p)} items={() => hooks.continueMenuItems(p, openDetails)}>
          {(openMenu) => (
            <PosterCard
              title={p.title}
              posterUrl={p.posterUrl}
              progress={p.positionSeconds / p.durationSeconds}
              subtitle={episodeLabel(p)}
              onPress={() => resumeEntry(p)}
              onLongPress={openMenu}
            />
          )}
        </TitleMenu>
      )}
    />
  );
}

/** Saved titles (D-055): the first ones; the title and the "See all" card open My List. */
function MyListRow() {
  const { hooks, openSection } = useScreenHost();
  const items = hooks.useWatchlist((s) => s.items.data) ?? [];
  if (items.length === 0) return null;
  const open = () => openSection('mylist');
  return (
    <Row
      title={t('My List')}
      items={items.slice(0, ROW_SIZE)}
      keyOf={(item) => `${item.section}-${item.masterId}`}
      testID="row-mylist"
      onTitlePress={open}
      more={items.length > ROW_SIZE ? { onPress: open } : undefined}
      render={(item) => <TitleCard section={item.section} item={watchlistCard(item)} />}
    />
  );
}

/** The channels the profile watched last; until there are any, the first live category (issue #122, D-129). */
function LiveRow() {
  const { hooks, openSection, play } = useScreenHost();
  const row = hooks.useLiveHomeRow();
  const { categoryId } = row;
  return (
    <Row
      title={row.title}
      items={row.channels.slice(0, ROW_SIZE)}
      keyOf={(c) => c.id}
      empty={t('No channels.')}
      testID="row-live"
      more={
        !row.recent && categoryId && row.channels.length > ROW_SIZE
          ? { landscape: true, onPress: () => openSection('live', categoryId) }
          : undefined
      }
      render={(c) => (
        <PosterCard landscape title={c.name} posterUrl={c.logoUrl} badge={t('LIVE')} onPress={() => play(recentChannelTarget(c))} />
      )}
    />
  );
}

/** The first titles of a section or category. The title and the "See all" card open Movies/Series on that category. */
function TitleRow({ section, category, title }: { section: LibrarySection; category?: MediaCategory; title: string }) {
  const { hooks, openSection } = useScreenHost();
  const page = hooks.usePagedLibrary(section, { categoryId: category?.id }, ROW_SIZE);
  if (page.done && page.items.length === 0) return null;
  const open = () => openSection(section, category?.id ?? null);
  return (
    <Row
      title={title}
      items={page.items}
      keyOf={(item) => item.id}
      testID={`row-${section}-${category?.id ?? 'all'}`}
      loading={page.loadingFirst}
      empty={page.error ? t('Could not load this row.') : ' '}
      onTitlePress={open}
      more={page.hasMore ? { onPress: open } : undefined}
      render={(item) => <TitleCard section={section} item={item} />}
    />
  );
}

/** "Top rated": the 25 best rated of the titles added last; the app's own row, so no "See all" (D-040, issue #188). */
function TopRatedRow({ section, title }: { section: LibrarySection; title: string }) {
  const { hooks } = useScreenHost();
  const page = hooks.usePagedLibrary(section, { sort: DEFAULT_LIBRARY_SORT }, TOP_RATED_POOL);
  const items = topRated(page.items);
  // Only the first page is read: the row hides once it is in and has no rated title.
  if (!page.loadingFirst && !page.error && items.length === 0) return null;
  return (
    <Row
      title={title}
      items={items}
      keyOf={(item) => item.id}
      testID={`row-${section}-top-rated`}
      loading={page.loadingFirst}
      empty={page.error ? t('Could not load this row.') : ' '}
      render={(item) => <TitleCard section={section} item={item} />}
    />
  );
}

/**
 * Where the hero goes, while the saved library is read after a start (D-119). Android's spinner turns on the UI
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

/** Featured movie: backdrop with two shades, big title, plot, Play and More Info; on desktop a muted trailer (D-025). */
function Hero({ candidates, onFocus }: { candidates: MasterCard[]; onFocus?(): void }) {
  const { hooks, openDetails, play: playTarget } = useScreenHost();
  const { featured, meta, play, backdrop } = hooks.useHeroTitle(candidates);
  const { width, height } = useWindowDimensions();
  const sizes = useSizes();
  const navH = useNavHeight();

  if (!featured) return <View style={{ height: navH }} />;

  const heroHeight = Math.max(420, Math.min(height * 0.8, width * 0.5625));
  return (
    <View style={[styles.hero, { height: heroHeight }]} role="region" accessibilityLabel={t('Featured')} testID="hero">
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <Trailer youtubeId={meta.data?.trailerYoutubeId} title={featured.title} />
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
        <Text accessibilityRole="header" style={[styles.heroTitle, { fontSize: sizes.heroTitle }]} numberOfLines={2}>
          {featured.title}
        </Text>
        {meta.data?.plot ? (
          <Text style={[styles.heroPlot, { fontSize: sizes.heroPlot }]} numberOfLines={3}>
            {meta.data.plot}
          </Text>
        ) : null}
        {/* Left at Play and Right at More Info stop there; they used to drop to the first row (D-069). */}
        <FocusRow style={styles.heroActions} testID="hero-actions">
          <FocusButton
            label={t('Play')}
            icon="play"
            variant="primary"
            hasTVPreferredFocus
            testID="hero-play"
            onFocus={onFocus}
            disabled={!play}
            onPress={() => play && playTarget(play)}
          />
          <FocusButton
            label={t('More Info')}
            icon="info"
            variant="secondary"
            testID="hero-info"
            onFocus={onFocus}
            onPress={() => openDetails('movies', featured.id)}
          />
        </FocusRow>
      </View>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // Above the hero they overlap.
  rows: { zIndex: 1 },
  bottom: { height: 60 },
  hero: { overflow: 'hidden' },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: colors.text, fontSize: 18 },
  heroContent: { position: 'absolute' },
  heroTitle: { color: colors.strong, fontWeight: '900', marginBottom: 12, ...shadow },
  heroPlot: { color: colors.text, marginBottom: 20, ...shadow },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
