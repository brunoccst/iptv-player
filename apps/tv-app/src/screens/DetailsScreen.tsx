import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
  bestVariant,
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
import { alignedColumn, useFocusGrid } from '../components/focusGrid';
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
  const { variant, series, allWatched, backdrop, play: playTarget, playLabel, startSeason } = useSeriesDetails(master);
  if (!variant) return <Text style={[styles.text, styles.padded]}>{t('No playable versions.')}</Text>;

  const play = () => {
    if (playTarget) navStore.getState().push({ name: 'player', target: playTarget });
  };

  return (
    <>
      <DetailsHero backdrop={backdrop} title={master.title} watched={allWatched}>
        <FocusButton
          label={playLabel}
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
      {series.data ? <Episodes series={series.data} master={master} initialSeason={startSeason} /> : null}
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
  // Per-episode version choice (first episode id → the chosen version's episode id), for this visit of the page.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const season = series.seasons.find((s) => s.number === seasonNumber) ?? series.seasons[0];
  const progress = useProgress((s) => s);
  const compact = useCompact();
  // The episode's menu (D-083): its "…" button, or holding OK on its Play button (a long touch on phones).
  const [menuFor, setMenuFor] = useState<MergedEpisode | null>(null);
  // TV: the episode whose buttons have the D-pad focus, so its description can roll. Moving between its own buttons
  // blurs one and focuses the next; the short wait keeps that from counting as leaving the episode.
  const [focusedEpisode, setFocusedEpisode] = useState<string | null>(null);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(leaving.current ?? undefined), []);
  const episodeFocus = (id: string) =>
    Platform.isTV
      ? {
          onFocus: () => {
            clearTimeout(leaving.current ?? undefined);
            setFocusedEpisode(id);
          },
          onBlur: () => {
            clearTimeout(leaving.current ?? undefined);
            leaving.current = setTimeout(() => setFocusedEpisode((current) => (current === id ? null : current)), 100);
          },
        }
      : {};
  // TV: Up/Down go to the same button of the episode above or below (Play, "…", version), not Play or the button the
  // episode last had focused.
  const grid = useFocusGrid();
  if (!season) return <Text style={[styles.muted, styles.episodes]}>{t('No episodes available.')}</Text>;
  const columns = (listed: MergedEpisode) => (listed.versions.length > 1 ? 3 : 2);
  const neighbour = (index: number, column: number) => {
    const other = season.episodes[index];
    return other ? grid.at(`${other.id}:${alignedColumn(column, columns(other))}`) : undefined;
  };
  const cell = (index: number, column: number) => ({
    focusRef: grid.ref(`${season.episodes[index]!.id}:${column}`),
    nextFocusUp: neighbour(index - 1, column),
    nextFocusDown: neighbour(index + 1, column),
  });
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
        {/* Watched on the left of the season choice, like an episode's tag; spaced like the other icons (issue #159). */}
        <FocusRow style={styles.seasonChoice}>
          {/* Only this season (issue #132). */}
          <WatchedButton
            kind="season"
            watched={isSeasonWatched(progress, season)}
            onChange={(next) => setSeasonWatched(stores.progress, season, context(season.episodes[0]!), next)}
            testID="season-watched-toggle"
          />
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
        </FocusRow>
      </Centered>
      {season.episodes.map((listed, index) => {
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
              {...episodeFocus(listed.id)}
              {...cell(index, 0)}
            />
            {/* Everything else is in the episode's menu, so the row fits a phone (D-083). */}
            <IconButton
              icon="more"
              label={t('More options for {title}', { title: episode.title })}
              onPress={() => setMenuFor(episode)}
              testID={`episode-${episode.id}-more`}
              {...episodeFocus(listed.id)}
              {...cell(index, 1)}
            />
            {listed.versions.length > 1 ? (
              <Select
                compact
                label={t('Version of {title}', { title: episode.title })}
                value={episode.id}
                options={listed.versions.map((v) => ({ value: v.episode.id, label: v.label }))}
                onChange={(episodeId) => setChosen((current) => ({ ...current, [listed.id]: episodeId }))}
                testID={`episode-${listed.id}-version`}
                {...episodeFocus(listed.id)}
                {...cell(index, 2)}
              />
            ) : null}
          </View>
        );
        return (
          // A focused episode moves to the middle of the screen.
          <Centered key={listed.id}>
            <FocusRow style={[styles.episode, compact && styles.episodeCompact]}>
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
                <EpisodePlot
                  text={[formatDuration(episode.durationSeconds), episode.plot].filter(Boolean).join(' · ')}
                  testID={`plot-${episode.id}`}
                  rolling={focusedEpisode === listed.id}
                />
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

/** TV: how long an episode keeps the focus before its description starts rolling, and how fast it rolls (issue #160). */
const PLOT_ROLL_DELAY_MS = 1500;
const PLOT_LINE_MS = 3000;
const PLOT_END_HOLD_MS = 3000;
const PLOT_LINE_HEIGHT = 19;

/**
 * An episode's length and plot: two lines, then "…"; a touch shows all of it and the row grows, another touch folds it
 * again (issue #160). Not focusable, so Play stays the first thing the D-pad lands on in an episode.
 * TV: while one of the episode's buttons keeps the focus (`rolling`), after a short wait the text slides up inside the
 * same two lines, a line at a time at reading pace, rests at the end, then starts again from the top.
 */
function EpisodePlot({ text, testID, rolling = false }: { text: string; testID: string; rolling?: boolean }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [height, setHeight] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!rolling) {
      setStarted(false);
      return;
    }
    const timer = setTimeout(() => setStarted(true), PLOT_ROLL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rolling]);
  useEffect(() => {
    offset.setValue(0);
    const distance = height - 2 * PLOT_LINE_HEIGHT;
    if (!started || distance <= 0) return;
    const roll = Animated.loop(
      Animated.sequence([
        Animated.timing(offset, {
          toValue: -distance,
          duration: (distance / PLOT_LINE_HEIGHT) * PLOT_LINE_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(PLOT_END_HOLD_MS),
        Animated.timing(offset, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(PLOT_ROLL_DELAY_MS),
      ]),
    );
    roll.start();
    return () => roll.stop();
  }, [started, height, offset]);
  if (started && !open)
    return (
      // The window's height is set rather than capped: a capped parent squeezes the text to two lines on Android, so
      // it measured no more to roll through and only lost its "…". Laid out on its own, the text keeps its full height.
      <View
        style={[styles.plotWindow, { height: Math.min(height || 2 * PLOT_LINE_HEIGHT, 2 * PLOT_LINE_HEIGHT) }]}
        testID={`${testID}-rolling`}
      >
        <Animated.Text
          style={[styles.episodePlot, styles.plotRolling, { transform: [{ translateY: offset }] }]}
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        >
          {text}
        </Animated.Text>
      </View>
    );
  return (
    <Pressable
      onPress={() => setOpen((current) => !current)}
      focusable={false}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityHint={open ? t('Show less') : t('Show more')}
      testID={testID}
    >
      <Text style={styles.episodePlot} numberOfLines={open ? undefined : 2}>
        {text}
      </Text>
    </Pressable>
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

/** Web `VariantSelect`: "Version / Stream Quality" dropdown, best first; "(best)" only when one is (D-136). */
function VariantSelect({ master, value }: { master: MasterDetails; value: VariantInfo }) {
  const best = useLibrary((s) => bestVariant(master.variants, s.versionLanguages));
  if (master.variants.length < 2) return null;
  return (
    <Centered style={styles.variant}>
      <Text style={styles.variantLabel}>{t('Version / Stream Quality')}</Text>
      <Select
        label={t('Version / Stream Quality')}
        value={value.streamId}
        options={master.variants.map((variant) => ({
          value: variant.streamId,
          label: `${variant.label}${variant === best ? ` (${t('best')})` : ''}`,
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
  seasonChoice: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  episodePlot: { color: colors.muted, fontSize: 13.6, lineHeight: PLOT_LINE_HEIGHT },
  // Two lines of the plot; the rolling text slides inside it (issue #160).
  plotWindow: { overflow: 'hidden' },
  plotRolling: { position: 'absolute', top: 0, left: 0, right: 0 },
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
