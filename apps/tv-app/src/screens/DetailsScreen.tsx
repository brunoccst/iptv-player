import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  episodeInVersion,
  episodeTarget,
  findEpisodeProgress,
  fluid,
  formatDuration,
  loadSeriesVersions,
  mergeSeriesVersions,
  movieTarget,
  progressTarget,
  selectVariant,
  seriesVersionsOf,
  type LibrarySection,
  type MasterDetails,
  type MergedEpisode,
  type MergedSeries,
  type ProgressDto,
  type VariantInfo,
} from '@iptv/shared';
import { api, navStore, stores } from '../appContext';
import { DownloadButton } from '../components/DownloadButton';
import { ExternalPlayerButton } from '../components/ExternalPlayerButton';
import { PlayOnTvButton } from '../components/PlayOnTvButton';
import { WatchlistButton } from '../components/WatchlistButton';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { FocusRow } from '../components/FocusRow';
import { Gradient } from '../components/Gradient';
import { IconButton } from '../components/IconButton';
import { Select } from '../components/Select';
import { useLibrary, useNav, useProgress } from '../hooks';
import { colors, fonts, radius, useCompact } from '../theme';
import { useAsync } from '../useAsync';

/** Web `DetailsModal`: a panel over the current page with backdrop, Play/Resume, download, facts, version select, episodes. */
export function DetailsScreen({ section, masterId }: { section: LibrarySection; masterId: string }) {
  const resource = useLibrary((s) => s.details[`${section}|${masterId}`]);
  const revision = useNav((s) => s.libraryRevision);
  const { width } = useWindowDimensions();

  useEffect(() => {
    void stores.library.getState().loadDetails(section, masterId);
  }, [section, masterId, revision]);

  const close = () => navStore.getState().back();
  return (
    <View style={styles.overlay} testID="details-screen" accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} focusable={false} accessibilityLabel="Close details" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.panel, { width: Math.min(850, width - 32) }]}>
          {resource?.data ? (
            section === 'movies' ? (
              <MovieDetails master={resource.data} />
            ) : (
              <SeriesDetailsView master={resource.data} />
            )
          ) : resource?.status === 'error' ? (
            <View style={styles.padded}>
              <ErrorText>{errorText(resource.error)}</ErrorText>
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.accent} style={styles.loading} accessibilityLabel="Loading" />
          )}
          <View style={styles.close}>
            <IconButton icon="close" label="Close" iconSize={24} onPress={close} testID="details-close" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Latest progress for any variant of this master (or series), used for "Resume". */
function useMasterProgress(master: MasterDetails, kind: 'movie' | 'episode'): ProgressDto | null {
  return useProgress(
    (s) =>
      (s.items.data ?? []).find(
        (p) =>
          p.kind === kind &&
          (p.masterId === master.id || master.variants.some((v) => v.streamId === (kind === 'movie' ? p.itemId : p.seriesId))),
      ) ?? null,
  );
}

function MovieDetails({ master }: { master: MasterDetails }) {
  const variant = useLibrary((s) => selectVariant(s, master));
  const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
  const resume = useMasterProgress(master, 'movie');
  useEffect(() => {
    // Resuming a different version than the best one: preselect it so "Resume" continues where the user left off.
    if (resume && master.variants.some((v) => v.streamId === resume.itemId))
      stores.library.getState().selectVariant(master.id, resume.itemId);
  }, [resume?.itemId, master]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!variant) return <Text style={[styles.text, styles.padded]}>No playable versions.</Text>;
  const target = movieTarget(master, variant);
  const canResume = resume?.itemId === variant.streamId;
  const duration = meta.data?.durationSeconds ?? null;

  return (
    <>
      <DetailsHero backdrop={meta.data?.backdropUrls[0] ?? meta.data?.summary.posterUrl ?? master.posterUrl} title={master.title}>
        <FocusButton
          label={canResume ? 'Resume' : 'Play'}
          icon="play"
          variant="primary"
          hasTVPreferredFocus
          testID="details-play"
          onPress={() =>
            navStore.getState().push({ name: 'player', target: { ...target, startAt: canResume ? resume!.positionSeconds : undefined } })
          }
        />
        <DownloadButton target={target} />
        <PlayOnTvButton target={{ ...target, startAt: canResume ? resume!.positionSeconds : undefined }} testID="details-play-on-tv" />
        <ExternalPlayerButton target={target} testID="details-external" />
        <WatchlistButton section="movies" title={master} />
      </DetailsHero>
      <Body
        main={
          <>
            <Facts year={master.year} rating={meta.data?.summary.rating ?? master.rating} quality={variant.quality} runtime={duration} />
            <Text style={styles.text}>{meta.data?.plot ?? (meta.loading ? '' : 'No description.')}</Text>
            <VariantSelect master={master} value={variant} />
          </>
        }
        side={
          <>
            <Fact label="Cast" value={meta.data?.cast} />
            <Fact label="Genres" value={meta.data?.genre} />
            <Fact label="Director" value={meta.data?.director} />
            <Fact label="Source" value={variant.rawTitle} />
          </>
        }
      />
    </>
  );
}

function SeriesDetailsView({ master }: { master: MasterDetails }) {
  const variant = useLibrary((s) => selectVariant(s, master));
  // All versions' episode lists, merged into one (D-066); the chosen version plays where it has the episode.
  const versions = useAsync(variant ? `series-versions:${master.variants.map((v) => v.streamId).join(',')}` : null, () =>
    loadSeriesVersions(api, seriesVersionsOf(master)),
  );
  const merged = useMemo(() => (versions.data ? mergeSeriesVersions(versions.data, variant?.streamId) : null), [versions.data, variant]);
  const series = { ...versions, data: merged };
  const resume = useMasterProgress(master, 'episode');
  if (!variant) return <Text style={[styles.text, styles.padded]}>No playable versions.</Text>;

  const first = series.data?.seasons[0]?.episodes[0];
  const canResume = !!resume;
  const playTarget = canResume
    ? progressTarget(resume!)
    : first
      ? episodeTarget({ title: master.title, masterId: master.id, seriesId: first.seriesId, posterUrl: master.posterUrl }, first)
      : null;
  const play = () => {
    if (playTarget) navStore.getState().push({ name: 'player', target: playTarget });
  };

  return (
    <>
      <DetailsHero backdrop={series.data?.backdropUrls[0] ?? master.posterUrl} title={master.title}>
        <FocusButton
          label={canResume ? `Resume S${resume!.seasonNumber}:E${resume!.episodeNumber}` : 'Play'}
          icon="play"
          variant="primary"
          hasTVPreferredFocus
          disabled={!series.data}
          onPress={play}
          testID="details-play"
        />
        <PlayOnTvButton target={series.data ? playTarget : null} testID="details-play-on-tv" />
        <WatchlistButton section="series" title={master} />
      </DetailsHero>
      <Body
        main={
          <>
            <Facts
              year={master.year}
              rating={master.rating}
              quality={variant.quality}
              extra={series.data ? `${series.data.seasons.length} Season${series.data.seasons.length === 1 ? '' : 's'}` : null}
            />
            <Text style={styles.text}>{series.data?.summary.plot ?? ''}</Text>
            <VariantSelect master={master} value={variant} />
          </>
        }
        side={
          <>
            <Fact label="Cast" value={series.data?.cast} />
            <Fact label="Genres" value={series.data?.summary.genre} />
          </>
        }
      />
      {series.loading ? <ActivityIndicator color={colors.accent} style={styles.padded} /> : null}
      {series.error ? (
        <View style={styles.padded}>
          <ErrorText>{errorText(series.error)}</ErrorText>
        </View>
      ) : null}
      {series.data ? <Episodes series={series.data} master={master} initialSeason={canResume ? resume!.seasonNumber : null} /> : null}
    </>
  );
}

function Episodes({
  series,
  master,
  initialSeason,
}: {
  series: MergedSeries;
  master: MasterDetails;
  initialSeason: number | null | undefined;
}) {
  const [seasonNumber, setSeasonNumber] = useState(initialSeason ?? series.seasons[0]?.number ?? 1);
  // Per-episode version choice (first episode id → series id), for this visit of the page.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const season = series.seasons.find((s) => s.number === seasonNumber) ?? series.seasons[0];
  const progress = useProgress((s) => s);
  const compact = useCompact();
  if (!season) return <Text style={[styles.muted, styles.episodes]}>No episodes available.</Text>;
  const context = (episode: MergedEpisode) => ({
    title: master.title,
    masterId: master.id,
    seriesId: episode.seriesId,
    posterUrl: series.summary.posterUrl ?? master.posterUrl,
  });

  return (
    <View style={[styles.episodes, compact && styles.episodesCompact]} testID="episodes" accessibilityLabel="Episodes">
      <View style={styles.episodesHeader}>
        <Text style={styles.episodesTitle}>Episodes</Text>
        {series.seasons.length > 1 ? (
          <Select
            compact
            label="Season"
            value={String(season.number)}
            options={series.seasons.map((s) => ({ value: String(s.number), label: s.name }))}
            onChange={(value) => setSeasonNumber(Number(value))}
            testID="season-select"
          />
        ) : (
          <Text style={styles.muted}>{season.name}</Text>
        )}
      </View>
      {season.episodes.map((listed) => {
        const episode = episodeInVersion(listed, chosen[listed.id]);
        const target = episodeTarget(context(episode), episode);
        const saved = findEpisodeProgress(progress, episode);
        const play = () => navStore.getState().push({ name: 'player', target });
        const actions = (
          <View style={[styles.episodeActions, compact && styles.episodeActionsCompact]}>
            <IconButton icon="play" label={`Play ${episode.title}`} onPress={play} testID={`episode-${episode.id}`} />
            <DownloadButton target={target} />
            <PlayOnTvButton target={target} testID={`episode-${episode.id}-tv`} />
            <ExternalPlayerButton target={target} testID={`episode-${episode.id}-external`} />
          </View>
        );
        return (
          <FocusRow key={listed.id} style={[styles.episode, compact && styles.episodeCompact]}>
            {compact ? null : <Text style={styles.episodeNumber}>{episode.episodeNumber ?? '•'}</Text>}
            <Pressable
              style={[styles.still, compact && styles.stillCompact]}
              onPress={play}
              accessibilityLabel={`Play ${episode.title}`}
              focusable={false}
            >
              {episode.stillUrl ? <Image source={{ uri: episode.stillUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
              {saved && saved.durationSeconds > 0 ? (
                <View style={styles.stillTrack}>
                  <View
                    style={[styles.stillValue, { width: `${Math.min(100, (saved.positionSeconds / saved.durationSeconds) * 100)}%` }]}
                  />
                </View>
              ) : null}
            </Pressable>
            <View style={styles.episodeText}>
              <Text style={styles.episodeTitle} numberOfLines={compact ? 2 : undefined}>
                {episode.title}
              </Text>
              <Text style={styles.episodePlot} numberOfLines={2}>
                {[formatDuration(episode.durationSeconds), episode.plot].filter(Boolean).join(' · ')}
              </Text>
              {listed.versions.length > 1 ? (
                <View style={styles.episodeVersion}>
                  <Select
                    compact
                    label={`Version of ${episode.title}`}
                    value={episode.seriesId}
                    options={listed.versions.map((v) => ({ value: v.seriesId, label: v.label }))}
                    onChange={(seriesId) => setChosen((current) => ({ ...current, [listed.id]: seriesId }))}
                    testID={`episode-${listed.id}-version`}
                  />
                </View>
              ) : master.variants.length > 1 ? (
                <Text style={styles.episodePlot}>Only in {listed.versions[0]!.label}</Text>
              ) : null}
              {/* Phones: buttons under the text, so the title keeps the width. */}
              {compact ? actions : null}
            </View>
            {compact ? null : actions}
          </FocusRow>
        );
      })}
    </View>
  );
}

/** Web `VariantSelect`: "Version / Stream Quality" dropdown, best first. */
function VariantSelect({ master, value }: { master: MasterDetails; value: VariantInfo }) {
  if (master.variants.length < 2) return null;
  return (
    <View style={styles.variant}>
      <Text style={styles.variantLabel}>Version / Stream Quality</Text>
      <Select
        label="Version / Stream Quality"
        value={value.streamId}
        options={master.variants.map((variant, index) => ({
          value: variant.streamId,
          label: `${variant.label}${index === 0 ? ' (best)' : ''}`,
        }))}
        onChange={(streamId) => stores.library.getState().selectVariant(master.id, streamId)}
        testID="variant-button"
      />
    </View>
  );
}

function DetailsHero({ backdrop, title, children }: { backdrop: string | null | undefined; title: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const panel = Math.min(850, width - 32);
  const compact = useCompact();
  return (
    <View style={[styles.hero, { height: Math.min(480, (panel * 9) / 16) }]}>
      {backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <Gradient
        stops={[
          { offset: 0.5, color: colors.surface, opacity: 0 },
          { offset: 1, color: colors.surface },
        ]}
      />
      <View style={[styles.heading, compact && styles.headingCompact]}>
        <Text style={[styles.title, { fontSize: fluid(width, 26, 4, 45) }]} accessibilityRole="header">
          {title}
        </Text>
        <FocusRow style={styles.actions}>{children}</FocusRow>
      </View>
    </View>
  );
}

function Body({ main, side }: { main: ReactNode; side: ReactNode }) {
  const { width } = useWindowDimensions();
  const twoColumns = Math.min(850, width - 32) >= 600;
  const compact = useCompact();
  return (
    <View style={[styles.body, twoColumns && styles.bodyColumns, compact && styles.bodyCompact]}>
      <View style={twoColumns ? styles.mainColumn : undefined}>{main}</View>
      <View style={[styles.side, twoColumns && styles.sideColumn]}>{side}</View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Text style={styles.sideText}>
      {`${label}: `}
      <Text style={styles.sideValue}>{value}</Text>
    </Text>
  );
}

function Facts({
  year,
  rating,
  quality,
  runtime,
  extra,
}: {
  year: number | null;
  rating: number | null | undefined;
  quality: string | null;
  runtime?: number | null;
  extra?: string | null;
}) {
  return (
    <View style={styles.facts}>
      {rating != null ? <Text style={styles.rating}>{Math.round(rating * 10)}% rating</Text> : null}
      {year ? <Text style={styles.fact}>{year}</Text> : null}
      {runtime ? <Text style={styles.fact}>{formatDuration(runtime)}</Text> : null}
      {extra ? <Text style={styles.fact}>{extra}</Text> : null}
      {quality ? <Text style={styles.quality}>{quality}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.7)' },
  scroll: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  panel: { overflow: 'hidden', borderRadius: 8, backgroundColor: colors.surface, elevation: 12 },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 3 },
  loading: { padding: 64 },
  padded: { padding: 32 },
  hero: { width: '100%', backgroundColor: '#000' },
  heading: { position: 'absolute', left: 32, right: 32, bottom: 24 },
  // Phones: 16 px sides, the same as the episode list.
  headingCompact: { left: 16, right: 16 },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  body: { paddingTop: 16, paddingHorizontal: 32, paddingBottom: 32, gap: 24 },
  bodyColumns: { flexDirection: 'row' },
  bodyCompact: { paddingHorizontal: 16 },
  mainColumn: { flex: 2 },
  side: { gap: 12 },
  sideColumn: { flex: 1 },
  sideText: { color: colors.muted, fontSize: 13.6 },
  sideValue: { color: colors.text },
  text: { color: colors.text, fontSize: fonts.body, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: fonts.body },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 },
  rating: { color: colors.success, fontWeight: '700', fontSize: 14.4 },
  fact: { color: colors.text, fontSize: 14.4 },
  quality: { color: colors.text, borderWidth: 1, borderColor: colors.muted, borderRadius: 3, paddingHorizontal: 6, fontSize: fonts.tiny },
  variant: { gap: 6, marginTop: 16 },
  variantLabel: { color: colors.muted, fontSize: 12.8 },
  episodes: { paddingHorizontal: 32, paddingBottom: 32 },
  episodesCompact: { paddingHorizontal: 16 },
  episodesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  episodesTitle: { color: colors.strong, fontSize: 22.4, fontWeight: '700' },
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderRadius: radius,
  },
  episodeCompact: { padding: 8, gap: 12, alignItems: 'flex-start' },
  episodeNumber: { width: 32, color: colors.muted, fontSize: 22.4, textAlign: 'center' },
  still: { width: 140, aspectRatio: 16 / 9, borderRadius: radius, overflow: 'hidden', backgroundColor: '#333' },
  stillCompact: { width: 96 },
  stillTrack: { position: 'absolute', left: 8, right: 8, bottom: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  stillValue: { height: 3, backgroundColor: colors.accent },
  episodeText: { flex: 1 },
  episodeTitle: { color: colors.strong, fontWeight: '700', fontSize: fonts.body, marginBottom: 4 },
  episodePlot: { color: colors.muted, fontSize: 13.6 },
  episodeVersion: { flexDirection: 'row', marginTop: 6 },
  episodeActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  episodeActionsCompact: { marginTop: 8 },
});
