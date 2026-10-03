import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TVFocusGuideView,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  chooseVersion,
  episodeInVersion,
  episodeTarget,
  findEpisodeProgress,
  episodeMenuItems,
  type EpisodeMenuItemId,
  type PlayTarget,
  episodeLabel,
  isEpisodeWatched,
  setSeriesWatched,
  setEpisodeWatched,
  isWatched,
  fluid,
  formatDuration,
  type LibrarySection,
  type MasterDetails,
  type MergedEpisode,
  type MergedSeries,
  type VariantInfo,
  t,
  tn,
  isSeasonWatched,
  setSeasonWatched,
} from '@iptv/shared';
import { api, navStore, stores } from '../appContext';
import { DownloadButton, useDownload } from '../components/DownloadButton';
import { ExternalPlayerButton, useExternalPlayer } from '../components/ExternalPlayerButton';
import { PlayOnTvButton, usePlayOnTv } from '../components/PlayOnTvButton';
import { WatchedButton } from '../components/WatchedButton';
import { WatchlistButton } from '../components/WatchlistButton';
import { ErrorText, errorText } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { FocusRow } from '../components/FocusRow';
import { Gradient } from '../components/Gradient';
import { IconButton } from '../components/IconButton';
import { Select } from '../components/Select';
import { useLibrary, useMovieDetails, useNav, useProgress, useSeriesDetails } from '../hooks';
import { colors, fonts, radius, useCompact } from '../theme';
import { WatchedTag } from '../components/WatchedTag';
import { CardMenu } from '../components/CardMenu';

/** Space above the panel in the scroll view. */
const PANEL_TOP = 32;

const CenterFocus = createContext<((view: View | null) => void) | null>(null);

/** A part of the panel that scrolls to the middle of the screen when something in it gets focus (TV). */
function Centered({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const center = useContext(CenterFocus);
  const ref = useRef<View>(null);
  return (
    <View ref={ref} style={style} testID={testID} onFocus={center ? () => center(ref.current) : undefined}>
      {children}
    </View>
  );
}

/** Web `DetailsModal`: a panel over the current page with backdrop, Play/Resume, download, facts, version select, episodes. */
export function DetailsScreen({ section, masterId }: { section: LibrarySection; masterId: string }) {
  const resource = useLibrary((s) => s.details[`${section}|${masterId}`]);
  const revision = useNav((s) => s.libraryRevision);
  const { width } = useWindowDimensions();

  useEffect(() => {
    void stores.library.getState().loadDetails(section, masterId);
  }, [section, masterId, revision]);

  const close = () => navStore.getState().back();
  // A focused part (version, season, an episode) scrolls to the middle of the screen, not just into view at the edge.
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const panel = useRef<View>(null);
  const center = (view: View | null) => {
    if (!view || !panel.current) return;
    view.measureLayout(panel.current, (_x, y, _w, h) =>
      scroll.current?.scrollTo({ y: Math.max(0, PANEL_TOP + y - (height - h) / 2), animated: true }),
    );
  };
  return (
    // TV: the D-pad stays in the panel; the page behind it is never reached (D-075).
    <FocusTrap style={styles.overlay} testID="details-screen">
      <Pressable style={StyleSheet.absoluteFill} onPress={close} focusable={false} accessibilityLabel={t('Close details')} />
      <ScrollView ref={scroll} contentContainerStyle={styles.scroll}>
        <View ref={panel} style={[styles.panel, { width: Math.min(850, width - 32) }]}>
          <CenterFocus.Provider value={Platform.isTV ? center : null}>
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
              <ActivityIndicator size="large" color={colors.accent} style={styles.loading} accessibilityLabel={t('Loading')} />
            )}
          </CenterFocus.Provider>
          <View style={styles.close}>
            <IconButton icon="close" label={t('Close')} iconSize={24} onPress={close} testID="details-close" />
          </View>
        </View>
      </ScrollView>
    </FocusTrap>
  );
}

function MovieDetails({ master }: { master: MasterDetails }) {
  const { variant, meta, watched, canResume, target, play, backdrop, duration, rating, setWatched } = useMovieDetails(master);
  if (!variant || !target || !play) return <Text style={[styles.text, styles.padded]}>{t('No playable versions.')}</Text>;

  return (
    <>
      <DetailsHero backdrop={backdrop} title={master.title} watched={watched}>
        <FocusButton
          label={canResume ? t('Resume') : t('Play')}
          icon="play"
          variant="primary"
          hasTVPreferredFocus
          testID="details-play"
          onPress={() => navStore.getState().push({ name: 'player', target: play })}
        />
        <DownloadButton target={target} />
        <PlayOnTvButton target={play} testID="details-play-on-tv" />
        <ExternalPlayerButton target={target} testID="details-external" />
        <WatchedButton kind="movie" watched={watched} onChange={setWatched} />
        <WatchlistButton section="movies" title={master} />
      </DetailsHero>
      <Body
        main={
          <>
            <Facts year={master.year} rating={rating} quality={variant.quality} runtime={duration} />
            <Text style={styles.text}>{meta.data?.plot ?? (meta.loading ? '' : t('No description.'))}</Text>
            <VariantSelect master={master} value={variant} />
          </>
        }
        side={
          <>
            <Fact label={t('Cast')} value={meta.data?.cast} />
            <Fact label={t('Genres')} value={meta.data?.genre} />
            <Fact label={t('Director')} value={meta.data?.director} />
            <Fact label={t('Source')} value={variant.rawTitle} />
          </>
        }
      />
    </>
  );
}

function SeriesDetailsView({ master }: { master: MasterDetails }) {
  // All versions' episode lists merged (D-066); resume; every episode watched (the tag, D-082).
  const { variant, series, resume, allWatched, backdrop, play: playTarget } = useSeriesDetails(master);
  if (!variant) return <Text style={[styles.text, styles.padded]}>{t('No playable versions.')}</Text>;

  const canResume = !!resume;
  const play = () => {
    if (playTarget) navStore.getState().push({ name: 'player', target: playTarget });
  };

  return (
    <>
      <DetailsHero backdrop={backdrop} title={master.title} watched={allWatched}>
        <FocusButton
          label={
            canResume
              ? t('Resume S{seasonNumber}:E{episodeNumber}', { seasonNumber: resume!.seasonNumber, episodeNumber: resume!.episodeNumber })
              : t('Play')
          }
          icon="play"
          variant="primary"
          hasTVPreferredFocus
          disabled={!series.data}
          onPress={play}
          testID="details-play"
        />
        <PlayOnTvButton target={series.data ? playTarget : null} testID="details-play-on-tv" />
        <WatchedButton kind="series" watched={allWatched} onChange={(next) => setSeriesWatched({ api, ...stores }, master.id, next)} />
        <WatchlistButton section="series" title={master} />
      </DetailsHero>
      <Body
        main={
          <>
            <Facts
              year={master.year}
              rating={master.rating}
              quality={variant.quality}
              extra={series.data ? tn('{count} Season', '{count} Seasons', series.data.seasons.length) : null}
            />
            <Text style={styles.text}>{series.data?.summary.plot ?? ''}</Text>
            <VariantSelect master={master} value={variant} />
          </>
        }
        side={
          <>
            <Fact label={t('Cast')} value={series.data?.cast} />
            <Fact label={t('Genres')} value={series.data?.summary.genre} />
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
  // The episode's menu (D-083): its "…" button, or holding OK on its Play button (a long touch on phones).
  const [menuFor, setMenuFor] = useState<MergedEpisode | null>(null);
  if (!season) return <Text style={[styles.muted, styles.episodes]}>{t('No episodes available.')}</Text>;
  const context = (episode: MergedEpisode) => ({
    title: master.title,
    masterId: master.id,
    seriesId: episode.seriesId,
    posterUrl: series.summary.posterUrl ?? master.posterUrl,
  });

  return (
    <View style={[styles.episodes, compact && styles.episodesCompact]} testID="episodes" accessibilityLabel={t('Episodes')}>
      <Centered style={styles.episodesHeader}>
        <Text style={styles.episodesTitle}>{t('Episodes')}</Text>
        {series.seasons.length > 1 ? (
          <Select
            compact
            label={t('Season')}
            value={String(season.number)}
            options={series.seasons.map((s) => ({ value: String(s.number), label: s.name }))}
            onChange={(value) => setSeasonNumber(Number(value))}
            testID="season-select"
          />
        ) : (
          <Text style={styles.muted}>{season.name}</Text>
        )}
        {/* Only this season (issue #132). */}
        <WatchedButton
          kind="season"
          watched={isSeasonWatched(progress, season)}
          onChange={(next) => setSeasonWatched(stores.progress, season, context(season.episodes[0]!), next)}
          testID="season-watched-toggle"
        />
      </Centered>
      {season.episodes.map((listed) => {
        const episode = episodeInVersion(listed, chosen[listed.id]);
        const target = episodeTarget(context(episode), episode);
        const saved = findEpisodeProgress(progress, episode);
        const play = () => navStore.getState().push({ name: 'player', target });
        const actions = (
          <View style={[styles.episodeActions, compact && styles.episodeActionsCompact]}>
            <IconButton
              icon="play"
              label={t('Play {title}', { title: episode.title })}
              onPress={play}
              onLongPress={() => setMenuFor(episode)}
              testID={`episode-${episode.id}`}
            />
            {/* Everything else is in the episode's menu, so the row fits a phone (D-083). */}
            <IconButton
              icon="more"
              label={t('More options for {title}', { title: episode.title })}
              onPress={() => setMenuFor(episode)}
              testID={`episode-${episode.id}-more`}
            />
            {/* After the buttons, so Play is the first thing focused in an episode. */}
            {listed.versions.length > 1 ? (
              <Select
                compact
                label={t('Version of {title}', { title: episode.title })}
                value={episode.seriesId}
                options={listed.versions.map((v) => ({ value: v.seriesId, label: v.label }))}
                onChange={(seriesId) => setChosen((current) => ({ ...current, [listed.id]: seriesId }))}
                testID={`episode-${listed.id}-version`}
              />
            ) : null}
          </View>
        );
        return (
          // Entering an episode from above or below lands on Play, and the episode moves to the middle of the screen.
          <Centered key={listed.id}>
            <FocusRow autoFocus style={[styles.episode, compact && styles.episodeCompact]}>
              {compact ? null : <Text style={styles.episodeNumber}>{episode.episodeNumber ?? '•'}</Text>}
              <Pressable
                style={[styles.still, compact && styles.stillCompact]}
                onPress={play}
                accessibilityLabel={t('Play {title}', { title: episode.title })}
                focusable={false}
              >
                {episode.stillUrl ? <Image source={{ uri: episode.stillUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                {isWatched(saved) ? (
                  <WatchedTag style={styles.stillTag} testID={`episode-${episode.id}-watched`} />
                ) : saved && saved.durationSeconds > 0 ? (
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
                {listed.versions.length === 1 && master.variants.length > 1 ? (
                  <Text style={styles.episodePlot}>{t('Only in {label}', { label: listed.versions[0]!.label })}</Text>
                ) : null}
                {/* Phones: buttons under the text, so the title keeps the width. */}
                {compact ? actions : null}
              </View>
              {compact ? null : actions}
            </FocusRow>
          </Centered>
        );
      })}
      {menuFor ? (
        <EpisodeMenu
          episode={menuFor}
          target={episodeTarget(context(menuFor), menuFor)}
          watched={isEpisodeWatched(progress, menuFor)}
          onWatched={(watched) => void setEpisodeWatched(stores.progress, menuFor, context(menuFor), watched)}
          onClose={() => setMenuFor(null)}
        />
      ) : null}
    </View>
  );
}

/** An episode's options (D-083): Mark as (not) watched, Download, Play on the paired TV, Open in another player. */
function EpisodeMenu({
  episode,
  target,
  watched,
  onWatched,
  onClose,
}: {
  episode: MergedEpisode;
  target: PlayTarget;
  watched: boolean;
  onWatched(watched: boolean): void;
  onClose(): void;
}) {
  const download = useDownload(target);
  const playOnTv = usePlayOnTv(target);
  const external = useExternalPlayer(target);
  const run: Record<EpisodeMenuItemId, () => void> = {
    watched: () => onWatched(true),
    unwatched: () => onWatched(false),
    download: () => download?.toggle(),
    'play-on-tv': () => playOnTv?.play(),
    external: () => external?.open(),
  };
  const items = episodeMenuItems({
    watched,
    download: download?.menu,
    tvName: playOnTv?.tvName,
    externalPlayer: external ? 'app' : null,
  });
  return (
    <CardMenu
      title={episode.title}
      subtitle={episodeLabel(episode)}
      onClose={onClose}
      actions={items.map((item) => ({
        label: item.label,
        disabled: item.disabled,
        icon: item.icon,
        testID: `card-menu-${item.id}`,
        onPress: run[item.id],
      }))}
    />
  );
}

/** Web `VariantSelect`: "Version / Stream Quality" dropdown, best first. */
function VariantSelect({ master, value }: { master: MasterDetails; value: VariantInfo }) {
  if (master.variants.length < 2) return null;
  return (
    <Centered style={styles.variant}>
      <Text style={styles.variantLabel}>{t('Version / Stream Quality')}</Text>
      <Select
        label={t('Version / Stream Quality')}
        value={value.streamId}
        options={master.variants.map((variant, index) => ({
          value: variant.streamId,
          label: `${variant.label}${index === 0 ? ` (${t('best')})` : ''}`,
        }))}
        onChange={(streamId) => {
          const picked = master.variants.find((variant) => variant.streamId === streamId);
          if (picked) chooseVersion(stores, master.id, picked);
        }}
        testID="variant-button"
      />
    </Centered>
  );
}

function DetailsHero({
  backdrop,
  title,
  watched,
  children,
}: {
  backdrop: string | null | undefined;
  title: string;
  /** "Watched" tag next to the title (D-081). */
  watched?: boolean;
  children: ReactNode;
}) {
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
        {watched ? <WatchedTag style={styles.titleTag} testID="details-watched" /> : null}
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
      {rating != null ? <Text style={styles.rating}>{t('{percent}% rating', { percent: Math.round(rating * 10) })}</Text> : null}
      {year ? <Text style={styles.fact}>{year}</Text> : null}
      {runtime ? <Text style={styles.fact}>{formatDuration(runtime)}</Text> : null}
      {extra ? <Text style={styles.fact}>{extra}</Text> : null}
      {quality ? <Text style={styles.quality}>{quality}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.7)' },
  scroll: { alignItems: 'center', paddingVertical: PANEL_TOP, paddingHorizontal: 16 },
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
  stillTag: { position: 'absolute', right: 6, bottom: 6 },
  titleTag: { marginTop: -4, marginBottom: 10 },
  episodeText: { flex: 1 },
  episodeTitle: { color: colors.strong, fontWeight: '700', fontSize: fonts.body, marginBottom: 4 },
  episodePlot: { color: colors.muted, fontSize: 13.6 },
  episodeActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  episodeActionsCompact: { marginTop: 8 },
});

/** TV: a focus guide that keeps the D-pad inside (all four directions); elsewhere a plain modal view. */
function FocusTrap({ style, testID, children }: { style: StyleProp<ViewStyle>; testID: string; children: ReactNode }) {
  if (!Platform.isTV)
    return (
      <View style={style} testID={testID} accessibilityViewIsModal>
        {children}
      </View>
    );
  return (
    <TVFocusGuideView trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={style} testID={testID} accessibilityViewIsModal>
      {children}
    </TVFocusGuideView>
  );
}
