import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { CenteringScrollView } from '../components/CenterScroll';
import { Chip } from '../components/ChipBar';
import { FocusRow } from '../components/FocusRow';
import {
  liveTarget,
  SEARCH_BY_TITLE,
  SEARCH_KINDS,
  SEARCH_MIN_LENGTH,
  type LibrarySection,
  type SearchKind,
  t,
  useSearchQuery,
  programmeWhen,
} from '@iptv/shared';
import { navStore } from '../appContext';
import { PosterCard } from '../components/PosterCard';
import { useNav } from '../hooks';
import { colors, useSizes, useNavHeight } from '../theme';
import { MasterCardItem, TvLines, useGridColumns } from './titles';
import { useChannelSearch, usePagedLibrary, useProgrammeSearch } from '../hooks';

const PAGE = 100;
/** TV: smaller pages that load as the focus nears the end; only the lines near the focus stay mounted (D-095). */
const TV_PAGE = 36;

/** Same as the web search page ("Results for …": Movies and Series grids), plus matching live channels. Text comes from the top nav. */
export function SearchScreen() {
  const search = useNav((s) => s.search);
  const submits = useNav((s) => s.searchSubmits);
  // Waits until typing pauses (adapted to the typing speed); Enter searches at once (D-124).
  const query = useSearchQuery(search, submits);
  const sizes = useSizes();
  const navH = useNavHeight();

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
            {SEARCH_KINDS.map((option) => (
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
            {shows('live') ? <ProgrammeResults key={`p-${query}`} query={query} /> : null}
          </>
        ) : null}
      </CenteringScrollView>
    </View>
  );
}

/** One result grid; "More results" loads the next page (the page scrolls as a whole). */
function SearchGrid({ section, query, title }: { section: LibrarySection; query: string; title: string }) {
  const tv = Platform.isTV;
  const page = usePagedLibrary(section, { search: query, sort: SEARCH_BY_TITLE }, tv ? TV_PAGE : PAGE);
  const { columns, itemWidth } = useGridColumns();
  const sizes = useSizes();
  // Where this section sits in the page, for centering its lines (D-098).
  const sectionY = useRef(0);
  const lines = Array.from({ length: Math.ceil(page.items.length / columns) }, (_, i) => page.items.slice(i * columns, (i + 1) * columns));

  const renderLine = (line: (typeof lines)[number]) => (
    <FocusRow key={line[0]!.id} style={[styles.line, { paddingHorizontal: sizes.gutter }]}>
      {line.map((item) => (
        <MasterCardItem key={item.id} section={section} item={item} width={itemWidth} />
      ))}
    </FocusRow>
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
  const channels = useChannelSearch(query);
  const sizes = useSizes();

  if (!channels?.length) {
    return alone && channels ? <Text style={[styles.muted, { marginHorizontal: sizes.gutter }]}>{t('No channels.')}</Text> : null;
  }
  return (
    <View style={styles.section} testID="row-live-search">
      <Text style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>{t('Live TV')}</Text>
      <FocusRow style={[styles.line, { paddingHorizontal: sizes.gutter, flexWrap: 'wrap' }]}>
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
      </FocusRow>
    </View>
  );
}

/** Programmes of the full TV guide with the search in their title, on now first; Select plays the channel (issue #119). */
function ProgrammeResults({ query }: { query: string }) {
  const found = useProgrammeSearch(query);
  const sizes = useSizes();
  if (!found?.length) return null;
  const now = Date.now();
  return (
    <View style={styles.section} testID="row-programme-search">
      <Text style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>{t('On TV')}</Text>
      <FocusRow style={[styles.line, { paddingHorizontal: sizes.gutter, flexWrap: 'wrap' }]}>
        {found.map(({ channel, programme }) => (
          <PosterCard
            key={`${channel.id}-${programme.start}`}
            landscape
            title={programme.title}
            subtitle={`${channel.name} · ${programmeWhen(programme, now)}`}
            posterUrl={channel.logoUrl}
            badge={Date.parse(programme.start) <= now ? t('LIVE') : null}
            onPress={() => navStore.getState().push({ name: 'player', target: liveTarget(channel, programme.title) })}
          />
        ))}
      </FocusRow>
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
