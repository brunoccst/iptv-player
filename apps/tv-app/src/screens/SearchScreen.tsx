import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { CenteringScrollView } from '../components/CenterScroll';
import { Chip } from '../components/ChipBar';
import { FocusRow } from '../components/FocusRow';
import { liveTarget, type LibrarySection, type LibrarySortChoice, type LiveChannel, t } from '@iptv/shared';
import { api, navStore } from '../appContext';
import { PosterCard } from '../components/PosterCard';
import { useNav } from '../hooks';
import { colors, useSizes, useNavHeight } from '../theme';
import { MasterCardItem, TvLines, useGridColumns } from './titles';
import { searchDelay, SEARCH_MIN_LENGTH } from './searchDelay';
import { usePagedLibrary } from './usePagedLibrary';

const PAGE = 100;
/** TV: smaller pages that load as the focus nears the end; only the lines near the focus stay mounted (D-095). */
const TV_PAGE = 36;
/** Search results read best alphabetically. */
const BY_TITLE: LibrarySortChoice = { sort: 'title', order: 'asc' };
const MAX_CHANNELS = 30;

/** Which results show (D-108): everything, or only movies, series or live channels. */
type SearchKind = 'all' | 'movies' | 'series' | 'live';
const KINDS: { kind: SearchKind; label: () => string }[] = [
  { kind: 'all', label: () => t('All') },
  { kind: 'movies', label: () => t('Movies') },
  { kind: 'series', label: () => t('Series') },
  { kind: 'live', label: () => t('Live TV') },
];

/** Same as the web search page ("Results for …": Movies and Series grids), plus matching live channels. Text comes from the top nav. */
export function SearchScreen() {
  const search = useNav((s) => s.search);
  const submits = useNav((s) => s.searchSubmits);
  // Starts empty: the first letter opens this page, and searching for it alone froze typing on big libraries.
  const [query, setQuery] = useState('');
  const sizes = useSizes();
  const navH = useNavHeight();
  const typing = useRef({ last: 0, gaps: [] as number[] });

  // Waits until typing pauses, adapted to how fast the user types (searchDelay.ts).
  useEffect(() => {
    const now = Date.now();
    const state = typing.current;
    if (state.last) state.gaps = [...state.gaps, now - state.last].slice(-8);
    state.last = now;
    const text = search.trim();
    const timer = setTimeout(() => setQuery(text.length >= SEARCH_MIN_LENGTH ? text : ''), searchDelay(state.gaps));
    return () => clearTimeout(timer);
  }, [search]);

  // Enter on the keyboard: search now.
  const firstSubmit = useRef(submits);
  useEffect(() => {
    if (submits !== firstSubmit.current && search.trim()) setQuery(search.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the Enter key triggers this
  }, [submits]);

  const [kind, setKind] = useState<SearchKind>('all');
  const shows = (section: SearchKind) => kind === 'all' || kind === section;

  // The title and the filter stay above the results, so "Results for …" is always on screen (D-108).
  return (
    <View style={styles.screen} testID="search-screen">
      <View style={{ paddingTop: navH + 24, paddingHorizontal: sizes.gutter }} testID="search-header">
        <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>
          {query ? t('Results for “{query}”', { query }) : search.trim().length < SEARCH_MIN_LENGTH ? t('Keep typing…') : t('Searching…')}
        </Text>
        {query ? (
          <FocusRow style={styles.filters} testID="search-filter">
            {KINDS.map((option) => (
              <Chip
                key={option.kind}
                label={option.label()}
                active={kind === option.kind}
                testID={`search-filter-${option.kind}`}
                onPress={() => setKind(option.kind)}
              />
            ))}
          </FocusRow>
        ) : null}
      </View>
      <CenteringScrollView
        key={kind}
        onlyCentering
        style={styles.results}
        testID="search-results"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 60 }}
      >
        {query ? (
          <>
            {shows('movies') ? <SearchGrid key={`m-${query}`} section="movies" query={query} title={t('Movies')} /> : null}
            {shows('series') ? <SearchGrid key={`s-${query}`} section="series" query={query} title={t('Series')} /> : null}
            {shows('live') ? <ChannelResults key={`c-${query}`} query={query} alone={kind === 'live'} /> : null}
          </>
        ) : null}
      </CenteringScrollView>
    </View>
  );
}

/** One result grid; "More results" loads the next page (the page scrolls as a whole). */
function SearchGrid({ section, query, title }: { section: LibrarySection; query: string; title: string }) {
  const tv = Platform.isTV;
  const page = usePagedLibrary(section, { search: query, sort: BY_TITLE }, tv ? TV_PAGE : PAGE);
  const { columns, itemWidth } = useGridColumns();
  const sizes = useSizes();
  // Where this section sits in the page, for centering its lines (D-098).
  const sectionY = useRef(0);
  const lines = Array.from({ length: Math.ceil(page.items.length / columns) }, (_, i) => page.items.slice(i * columns, (i + 1) * columns));

  const renderLine = (line: (typeof lines)[number]) => (
    <View key={line[0]!.id} style={[styles.line, { paddingHorizontal: sizes.gutter }]}>
      {line.map((item) => (
        <MasterCardItem key={item.id} section={section} item={item} width={itemWidth} />
      ))}
    </View>
  );

  return (
    <View style={styles.section} testID={`row-${section}-search`} onLayout={(event) => (sectionY.current = event.nativeEvent.layout.y)}>
      <Text style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>{title}</Text>
      {page.loadingFirst ? (
        <ActivityIndicator
          color={colors.accent}
          style={{ marginLeft: sizes.gutter, alignSelf: 'flex-start' }}
          accessibilityLabel={t('Loading')}
        />
      ) : page.items.length === 0 ? (
        <Text style={[styles.muted, { marginHorizontal: sizes.gutter }]}>{t('No titles found.')}</Text>
      ) : tv ? (
        <TvLines lines={lines} renderLine={renderLine} onNearEnd={page.loadMore} testPrefix={`search-${section}`} parentY={sectionY} />
      ) : (
        lines.map(renderLine)
      )}
      {page.loadingMore ? <ActivityIndicator color={colors.accent} accessibilityLabel={t('Loading more')} /> : null}
      {!tv && page.hasMore && !page.loadingMore ? (
        <Text style={[styles.more, { marginHorizontal: sizes.gutter }]} onPress={page.loadMore} accessibilityRole="button">
          {t('More results')}
        </Text>
      ) : null}
    </View>
  );
}

/** Matching live channels; `alone` (the Live TV filter): says so when there are none. */
function ChannelResults({ query, alone }: { query: string; alone: boolean }) {
  const [channels, setChannels] = useState<LiveChannel[] | null>(null);
  const sizes = useSizes();

  useEffect(() => {
    let cancelled = false;
    const needle = query.toLowerCase();
    // Search also finds channels in hidden categories (D-110).
    api.catalog.liveChannels(null, undefined, { includeHidden: true }).then(
      (all) => !cancelled && setChannels(all.filter((channel) => channel.name.toLowerCase().includes(needle)).slice(0, MAX_CHANNELS)),
      () => !cancelled && setChannels([]),
    );
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!channels?.length) {
    return alone && channels ? <Text style={[styles.muted, { marginHorizontal: sizes.gutter }]}>{t('No channels.')}</Text> : null;
  }
  return (
    <View style={styles.section} testID="row-live-search">
      <Text style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>{t('Live TV')}</Text>
      <View style={[styles.line, { paddingHorizontal: sizes.gutter, flexWrap: 'wrap' }]}>
        {channels.map((channel) => (
          <PosterCard
            key={channel.id}
            landscape
            title={channel.name}
            posterUrl={channel.logoUrl}
            badge={t('LIVE')}
            onPress={() =>
              navStore.getState().push({
                name: 'player',
                target: liveTarget(channel),
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
  results: { flex: 1 },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 16 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  section: { marginBottom: 32 },
  heading: { color: colors.text, fontWeight: '700', marginBottom: 12 },
  line: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  muted: { color: colors.muted, fontSize: 16 },
  more: { color: colors.strong, fontWeight: '700', fontSize: 16 },
});
