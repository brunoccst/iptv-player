import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { continueWatching, movieTarget, pageKey, progressTarget, selectVariant, type MasterCard } from '@iptv/shared';
import { api, navStore, stores } from '../appContext';
import { FocusButton } from '../components/FocusButton';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { useCatalog, useLibrary, useProgress } from '../hooks';
import { colors, fonts, safe, spacing } from '../theme';
import { useAsync } from '../useAsync';
import { LibraryRow } from './LibraryRow';

const ROW_SIZE = 30;

/** Hero + Continue Watching + Live TV + category rows. */
export function HomeScreen({ processing = false }: { processing?: boolean }) {
  const featured = useLibrary((s) => s.pages[pageKey('movies', { limit: ROW_SIZE })]?.data?.items ?? []);
  const movieCategories = useCatalog((s) => s.categories.movies?.data ?? []);
  const seriesCategories = useCatalog((s) => s.categories.series?.data ?? []);
  const resume = useProgress((s) => continueWatching(s.items.data ?? []));
  const liveCategories = useCatalog((s) => s.categories.live?.data ?? []);
  const firstLive = liveCategories[0]?.id ?? null;
  const channels = useCatalog((s) => (firstLive ? (s.liveChannels[firstLive]?.data ?? []) : []));

  useEffect(() => {
    const { library, catalog } = stores;
    void library.getState().loadPage('movies', { limit: ROW_SIZE });
    void catalog.getState().loadCategories('movies');
    void catalog.getState().loadCategories('series');
    void catalog.getState().loadCategories('live').then((loaded) => {
      if (loaded?.[0]) void catalog.getState().loadLiveChannels(loaded[0].id);
    });
  }, []);

  return (
    <ScrollView style={styles.screen} testID="home-screen">
      <Hero candidates={featured} />
      {processing ? <Text style={styles.notice} testID="library-processing">Organizing your library: grouping duplicate titles and versions…</Text> : null}
      {resume.length > 0 ? (
        <Row title="Continue Watching" items={resume} keyOf={(p) => `${p.kind}-${p.itemId}`} testID="row-continue"
          render={(p) => (
            <PosterCard title={p.title} posterUrl={p.posterUrl} progress={p.positionSeconds / p.durationSeconds}
              subtitle={p.kind === 'episode' && p.seasonNumber != null ? `S${p.seasonNumber}:E${p.episodeNumber ?? '?'}` : null}
              onPress={() => navStore.getState().push({ name: 'player', target: progressTarget(p) })} />
          )} />
      ) : null}
      <Row title={liveCategories[0] ? `Live TV: ${liveCategories[0].name}` : 'Live TV'} items={channels.slice(0, ROW_SIZE)} keyOf={(c) => c.id}
        render={(c) => (
          <PosterCard landscape title={c.name} posterUrl={c.logoUrl} badge="LIVE"
            onPress={() => navStore.getState().push({ name: 'player', target: { kind: 'live', streamId: c.id, container: 'm3u8', title: c.name, posterUrl: c.logoUrl } })} />
        )} />
      <LibraryRow section="series" title="Series" />
      {movieCategories.slice(0, 6).map((category) => <LibraryRow key={`m-${category.id}`} section="movies" category={category} title={category.name} />)}
      {seriesCategories.slice(0, 3).map((category) => <LibraryRow key={`s-${category.id}`} section="series" category={category} title={`Series: ${category.name}`} />)}
    </ScrollView>
  );
}

function Hero({ candidates }: { candidates: MasterCard[] }) {
  const featured = useMemo(() => candidates.find((item) => item.posterUrl) ?? candidates[0] ?? null, [candidates]);
  const [focusedOnce, setFocusedOnce] = useState(false);

  useEffect(() => {
    if (featured) void stores.library.getState().loadDetails('movies', featured.id);
  }, [featured]);

  const details = useLibrary((s) => (featured ? (s.details[`movies|${featured.id}`]?.data ?? null) : null));
  const variant = useLibrary((s) => (details ? selectVariant(s, details) : null));
  const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
  if (!featured) return <View style={styles.heroPlaceholder} />;

  const backdrop = meta.data?.backdropUrls[0] ?? featured.posterUrl;
  return (
    <View style={styles.hero} accessibilityLabel="Featured">
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={styles.heroShade} />
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle} numberOfLines={2}>{featured.title}</Text>
        {meta.data?.plot ? <Text style={styles.heroPlot} numberOfLines={2}>{meta.data.plot}</Text> : null}
        <View style={styles.heroActions}>
          <FocusButton label="Play" variant="primary" hasTVPreferredFocus={!focusedOnce} onFocus={() => setFocusedOnce(true)} testID="hero-play"
            disabled={!details || !variant} onPress={() => details && variant && navStore.getState().push({ name: 'player', target: movieTarget(details, variant) })} />
          <FocusButton label="More Info" testID="hero-info" onPress={() => navStore.getState().push({ name: 'details', section: 'movies', masterId: featured.id })} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  heroPlaceholder: { height: safe.vertical * 2 },
  notice: { color: colors.muted, fontSize: fonts.body, marginHorizontal: safe.horizontal, marginBottom: spacing.md },
  hero: { height: 300, marginBottom: spacing.md, justifyContent: 'flex-end' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  heroContent: { paddingHorizontal: safe.horizontal, paddingBottom: spacing.lg, maxWidth: 560, gap: spacing.sm },
  heroTitle: { color: colors.strong, fontSize: fonts.hero, fontWeight: '900' },
  heroPlot: { color: colors.text, fontSize: fonts.body },
  heroActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
