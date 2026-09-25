import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LibrarySection, LibrarySortChoice, LiveChannel } from '@iptv/shared';
import { api, navStore } from '../appContext';
import { PosterCard } from '../components/PosterCard';
import { useNav } from '../hooks';
import { colors, useSizes, useNavHeight } from '../theme';
import { MasterCardItem, useGridColumns } from './titles';
import { usePagedLibrary } from './usePagedLibrary';

const DEBOUNCE_MS = 300;
const PAGE = 100;
/** Search results read best alphabetically. */
const BY_TITLE: LibrarySortChoice = { sort: 'title', order: 'asc' };
const MAX_CHANNELS = 30;

/** Same as the web search page ("Results for …": Movies and Series grids), plus matching live channels. Text comes from the top nav. */
export function SearchScreen() {
  const search = useNav((s) => s.search);
  const [query, setQuery] = useState(search.trim());
  const sizes = useSizes();
  const navH = useNavHeight();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <ScrollView style={styles.screen} testID="search-screen" contentContainerStyle={{ paddingTop: navH + 24, paddingBottom: 60 }}>
      <Text style={[styles.title, { fontSize: sizes.pageTitle, marginHorizontal: sizes.gutter }]}>{`Results for “${query}”`}</Text>
      {query ? (
        <>
          <SearchGrid key={`m-${query}`} section="movies" query={query} title="Movies" />
          <SearchGrid key={`s-${query}`} section="series" query={query} title="Series" />
          <ChannelResults key={`c-${query}`} query={query} />
        </>
      ) : null}
    </ScrollView>
  );
}

/** One result grid; "More results" loads the next page (the page scrolls as a whole). */
function SearchGrid({ section, query, title }: { section: LibrarySection; query: string; title: string }) {
  const page = usePagedLibrary(section, { search: query, sort: BY_TITLE }, PAGE);
  const { columns, itemWidth } = useGridColumns();
  const sizes = useSizes();
  const lines = Array.from({ length: Math.ceil(page.items.length / columns) }, (_, i) => page.items.slice(i * columns, (i + 1) * columns));

  return (
    <View style={styles.section} testID={`row-${section}-search`}>
      <Text style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>{title}</Text>
      {page.loadingFirst ? (
        <ActivityIndicator
          color={colors.accent}
          style={{ marginLeft: sizes.gutter, alignSelf: 'flex-start' }}
          accessibilityLabel="Loading"
        />
      ) : page.items.length === 0 ? (
        <Text style={[styles.muted, { marginHorizontal: sizes.gutter }]}>No titles found.</Text>
      ) : (
        lines.map((line) => (
          <View key={line[0]!.id} style={[styles.line, { paddingHorizontal: sizes.gutter }]}>
            {line.map((item) => (
              <MasterCardItem key={item.id} section={section} item={item} width={itemWidth} />
            ))}
          </View>
        ))
      )}
      {page.loadingMore ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading more" /> : null}
      {page.hasMore && !page.loadingMore ? (
        <Text style={[styles.more, { marginHorizontal: sizes.gutter }]} onPress={page.loadMore} accessibilityRole="button">
          More results
        </Text>
      ) : null}
    </View>
  );
}

function ChannelResults({ query }: { query: string }) {
  const [channels, setChannels] = useState<LiveChannel[] | null>(null);
  const sizes = useSizes();

  useEffect(() => {
    let cancelled = false;
    const needle = query.toLowerCase();
    api.catalog.liveChannels(null).then(
      (all) => !cancelled && setChannels(all.filter((channel) => channel.name.toLowerCase().includes(needle)).slice(0, MAX_CHANNELS)),
      () => !cancelled && setChannels([]),
    );
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!channels?.length) return null;
  return (
    <View style={styles.section} testID="row-live-search">
      <Text style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>Live TV</Text>
      <View style={[styles.line, { paddingHorizontal: sizes.gutter, flexWrap: 'wrap' }]}>
        {channels.map((channel) => (
          <PosterCard
            key={channel.id}
            landscape
            title={channel.name}
            posterUrl={channel.logoUrl}
            badge="LIVE"
            onPress={() =>
              navStore.getState().push({
                name: 'player',
                target: { kind: 'live', streamId: channel.id, container: 'm3u8', title: channel.name, posterUrl: channel.logoUrl },
              })
            }
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
  section: { marginBottom: 32 },
  heading: { color: colors.text, fontWeight: '700', marginBottom: 12 },
  line: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  muted: { color: colors.muted, fontSize: 16 },
  more: { color: colors.strong, fontWeight: '700', fontSize: 16 },
});
