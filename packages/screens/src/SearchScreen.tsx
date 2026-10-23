import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import {
  liveTarget,
  programmeWhen,
  SEARCH_BY_TITLE,
  SEARCH_KINDS,
  SEARCH_MIN_LENGTH,
  type LibrarySection,
  type SearchKind,
  t,
  useSearchQuery,
} from '@iptv/shared';
import { useScreenHost } from './host';
import { GRID_GAP, useGridColumns } from './MyListScreen';
import { TitleCard } from './TitleCard';
import { TvLines } from './TitleGrid';
import { CenteringScrollView } from './ui/CenterScroll';
import { Chip } from './ui/ChipBar';
import { FocusRow } from './ui/FocusRow';
import { PosterCard } from './ui/PosterCard';
import { colors, useNavHeight, useSizes } from './ui/theme';

const PAGE = 100;
/** TV: smaller pages that load as the focus nears the end; only the lines near the focus stay mounted (D-094). */
const TV_PAGE = 36;
const web = Platform.OS === 'web';

/**
 * Search (D-079): "Results for …" with a filter (All, Movies, Series, Live TV, D-130), the Movies and Series grids, the
 * matching live channels and the guide's programmes (issue #119). The text comes from the top nav. One screen for TV,
 * phone and desktop (DECISIONS.md#d-196).
 */
export function SearchScreen() {
  const { Page, useSearch } = useScreenHost();
  const search = useSearch();
  // Waits until typing pauses (adapted to the typing speed); Enter searches at once (D-079).
  const query = useSearchQuery(search.text, search.submits);
  const sizes = useSizes();
  const navH = useNavHeight();

  const [kind, setKind] = useState<SearchKind>('all');
  const shows = (section: SearchKind) => kind === 'all' || kind === section;

  const header = (
    <View style={{ paddingTop: web ? 0 : navH + 24, paddingHorizontal: sizes.gutter }} testID="search-header">
      <Text accessibilityRole="header" style={[styles.title, { fontSize: sizes.pageTitle }]}>
        {query
          ? t('Results for “{query}”', { query })
          : search.text.trim().length < SEARCH_MIN_LENGTH
            ? t('Keep typing…')
            : t('Searching…')}
      </Text>
      {query ? (
        <FocusRow style={styles.filters} testID="search-filter" accessibilityRole="tablist" accessibilityLabel={t('Search')}>
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
  );
  const results = query ? (
    <>
      {shows('movies') ? <SearchGrid key={`m-${query}`} section="movies" query={query} title={t('Movies')} /> : null}
      {shows('series') ? <SearchGrid key={`s-${query}`} section="series" query={query} title={t('Series')} /> : null}
      {shows('live') ? <ChannelResults key={`c-${query}`} query={query} alone={kind === 'live'} /> : null}
      {shows('live') ? <ProgrammeResults key={`p-${query}`} query={query} /> : null}
    </>
  ) : null;

  // Desktop: the window scrolls the whole page.
  if (web)
    return (
      <Page testID="search-screen">
        {header}
        <View testID="search-results">{results}</View>
      </Page>
    );

  // The title and the filter stay above the results, so "Results for …" is always on screen (D-130).
  return (
    <View style={styles.screen} testID="search-screen">
      {header}
      <CenteringScrollView
        key={kind}
        onlyCentering
        style={styles.results}
        testID="search-results"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 60 }}
      >
        {results}
      </CenteringScrollView>
    </View>
  );
}

/** One result grid. TV loads more as the focus nears the end, desktop as its end scrolls into view, phone on "More results". */
function SearchGrid({ section, query, title }: { section: LibrarySection; query: string; title: string }) {
  const { hooks, EndSensor } = useScreenHost();
  const tv = Platform.isTV;
  const page = hooks.usePagedLibrary(section, { search: query, sort: SEARCH_BY_TITLE }, tv ? TV_PAGE : PAGE);
  const { columns, itemWidth } = useGridColumns();
  const sizes = useSizes();
  // Where this section sits in the page, for centering its lines (D-094).
  const sectionY = useRef(0);
  const lines = Array.from({ length: Math.ceil(page.items.length / columns) }, (_, i) => page.items.slice(i * columns, (i + 1) * columns));

  const renderLine = (line: (typeof lines)[number]) => (
    <FocusRow key={line[0]!.id} style={[styles.line, { paddingHorizontal: sizes.gutter }]}>
      {line.map((item) => (
        <TitleCard key={item.id} section={section} item={item} width={itemWidth} />
      ))}
    </FocusRow>
  );
  const more =
    page.hasMore && !page.loadingMore ? (
      web && EndSensor ? (
        <EndSensor onReached={page.loadMore} />
      ) : !tv ? (
        <Text style={[styles.more, { marginHorizontal: sizes.gutter }]} onPress={page.loadMore} accessibilityRole="button">
          {t('More results')}
        </Text>
      ) : null
    ) : null;

  return (
    <View style={styles.section} testID={`row-${section}-search`} onLayout={(event) => (sectionY.current = event.nativeEvent.layout.y)}>
      <Text accessibilityRole="header" style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>
        {title}
      </Text>
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
      {more}
    </View>
  );
}

/** Matching live channels; `alone` (the Live TV filter): says so when there are none. */
function ChannelResults({ query, alone }: { query: string; alone: boolean }) {
  const { hooks, play } = useScreenHost();
  const channels = hooks.useChannelSearch(query);
  const sizes = useSizes();

  if (!channels?.length) {
    return alone && channels ? <Text style={[styles.muted, { marginHorizontal: sizes.gutter }]}>{t('No channels.')}</Text> : null;
  }
  return (
    <View style={styles.section} testID="row-live-search">
      <Text accessibilityRole="header" style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>
        {t('Live TV')}
      </Text>
      <FocusRow style={[styles.line, styles.wrap, { paddingHorizontal: sizes.gutter }]}>
        {channels.map((channel) => (
          <PosterCard
            key={channel.id}
            landscape
            title={channel.name}
            posterUrl={channel.logoUrl}
            badge={t('LIVE')}
            onPress={() => play(liveTarget(channel))}
          />
        ))}
      </FocusRow>
    </View>
  );
}

/** Programmes of the full TV guide with the search in their title, on now first; Select plays the channel (issue #119). */
function ProgrammeResults({ query }: { query: string }) {
  const { hooks, play } = useScreenHost();
  const found = hooks.useProgrammeSearch(query);
  const sizes = useSizes();
  if (!found?.length) return null;
  const now = Date.now();
  return (
    <View style={styles.section} testID="row-programme-search">
      <Text accessibilityRole="header" style={[styles.heading, { fontSize: sizes.rowTitle, marginHorizontal: sizes.gutter }]}>
        {t('On TV')}
      </Text>
      <FocusRow style={[styles.line, styles.wrap, { paddingHorizontal: sizes.gutter }]}>
        {found.map(({ channel, programme }) => (
          <PosterCard
            key={`${channel.id}-${programme.start}`}
            landscape
            title={programme.title}
            subtitle={`${channel.name} · ${programmeWhen(programme, now)}`}
            posterUrl={channel.logoUrl}
            badge={Date.parse(programme.start) <= now ? t('LIVE') : null}
            onPress={() => play(liveTarget(channel, programme.title))}
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
  line: { flexDirection: 'row', gap: GRID_GAP, marginBottom: 24 },
  wrap: { flexWrap: 'wrap' },
  muted: { color: colors.muted, fontSize: 16 },
  more: { color: colors.strong, fontWeight: '700', fontSize: 16 },
});
