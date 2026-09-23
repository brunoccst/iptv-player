import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  episodeTarget, findProgress, formatDuration, movieTarget, progressTarget, selectVariant, type LibrarySection, type MasterDetails,
  type ProgressDto, type SeriesDetails, type VariantInfo,
} from '@iptv/shared';
import { api, navStore, stores } from '../appContext';
import { DownloadButton } from '../components/DownloadButton';
import { ErrorText, errorText, Loading } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { useLibrary, useNav, useProgress } from '../hooks';
import { colors, fonts, safe, spacing } from '../theme';
import { useAsync } from '../useAsync';

/** Title details: backdrop, facts, Play/Resume, Download, "Version / Stream Quality", seasons and episodes. */
export function DetailsScreen({ section, masterId }: { section: LibrarySection; masterId: string }) {
  const resource = useLibrary((s) => s.details[`${section}|${masterId}`]);
  const revision = useNav((s) => s.libraryRevision);

  useEffect(() => {
    void stores.library.getState().loadDetails(section, masterId);
  }, [section, masterId, revision]);

  if (resource?.status === 'error') return <View style={styles.screen}><ErrorText>{errorText(resource.error)}</ErrorText></View>;
  if (!resource?.data) return <View style={styles.screen}><Loading /></View>;
  return section === 'movies' ? <MovieDetailsView master={resource.data} /> : <SeriesDetailsView master={resource.data} />;
}

function latestProgress(items: ProgressDto[] | null, kind: 'movie' | 'episode', master: MasterDetails): ProgressDto | null {
  return (items ?? []).find((p) => p.kind === kind && (p.masterId === master.id || master.variants.some((v) => v.streamId === (kind === 'movie' ? p.itemId : p.seriesId)))) ?? null;
}

function MovieDetailsView({ master }: { master: MasterDetails }) {
  const variant = useLibrary((s) => selectVariant(s, master));
  const resume = useProgress((s) => latestProgress(s.items.data, 'movie', master));
  const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
  if (!variant) return <View style={styles.screen}><ErrorText>No playable versions.</ErrorText></View>;

  const target = movieTarget(master, variant);
  const canResume = resume?.itemId === variant.streamId;
  return (
    <Layout backdrop={meta.data?.backdropUrls[0] ?? master.posterUrl} title={master.title}>
      <Facts year={master.year} rating={meta.data?.summary.rating ?? master.rating} quality={variant.quality} extra={formatDuration(meta.data?.durationSeconds)} />
      <Text style={styles.plot} numberOfLines={4}>{meta.data?.plot ?? ''}</Text>
      <View style={styles.actions}>
        <FocusButton label={canResume ? 'Resume' : 'Play'} variant="primary" hasTVPreferredFocus testID="details-play"
          onPress={() => navStore.getState().push({ name: 'player', target: { ...target, startAt: canResume ? resume!.positionSeconds : undefined } })} />
        <DownloadButton target={target} />
        <VariantPicker master={master} value={variant} />
      </View>
    </Layout>
  );
}

function SeriesDetailsView({ master }: { master: MasterDetails }) {
  const variant = useLibrary((s) => selectVariant(s, master));
  const resume = useProgress((s) => latestProgress(s.items.data, 'episode', master));
  const series = useAsync(variant ? `series:${variant.streamId}` : null, () => api.catalog.seriesDetails(variant!.streamId));
  if (!variant) return <View style={styles.screen}><ErrorText>No playable versions.</ErrorText></View>;

  const first = series.data?.seasons[0]?.episodes[0];
  const canResume = resume?.seriesId === variant.streamId;
  const play = () => {
    if (canResume) navStore.getState().push({ name: 'player', target: progressTarget(resume!) });
    else if (first) navStore.getState().push({ name: 'player', target: episodeTarget({ title: master.title, masterId: master.id, seriesId: variant.streamId, posterUrl: master.posterUrl }, first) });
  };

  return (
    <Layout backdrop={series.data?.backdropUrls[0] ?? master.posterUrl} title={master.title}>
      <Facts year={master.year} rating={master.rating} quality={variant.quality}
        extra={series.data ? `${series.data.seasons.length} Season${series.data.seasons.length === 1 ? '' : 's'}` : null} />
      <Text style={styles.plot} numberOfLines={3}>{series.data?.summary.plot ?? ''}</Text>
      <View style={styles.actions}>
        <FocusButton label={canResume ? `Resume S${resume!.seasonNumber}:E${resume!.episodeNumber}` : 'Play'} variant="primary" hasTVPreferredFocus
          disabled={!series.data} onPress={play} testID="details-play" />
        <VariantPicker master={master} value={variant} />
      </View>
      {series.loading ? <Loading /> : null}
      {series.error ? <ErrorText>{errorText(series.error)}</ErrorText> : null}
      {series.data ? <Episodes key={variant.streamId} series={series.data} master={master} seriesId={variant.streamId} initialSeason={canResume ? resume!.seasonNumber : null} /> : null}
    </Layout>
  );
}

function Episodes({ series, master, seriesId, initialSeason }: { series: SeriesDetails; master: MasterDetails; seriesId: string; initialSeason: number | null }) {
  const [seasonNumber, setSeasonNumber] = useState(initialSeason ?? series.seasons[0]?.number ?? 1);
  const season = series.seasons.find((s) => s.number === seasonNumber) ?? series.seasons[0];
  const progress = useProgress((s) => s);
  if (!season) return null;
  const context = { title: master.title, masterId: master.id, seriesId, posterUrl: master.posterUrl };

  return (
    <View style={styles.episodes} testID="episodes">
      <View style={styles.actions}>
        {series.seasons.map((s) => (
          <FocusButton key={s.number} label={s.name} variant={s.number === season.number ? 'primary' : 'ghost'} onPress={() => setSeasonNumber(s.number)} />
        ))}
      </View>
      {season.episodes.map((episode) => {
        const target = episodeTarget(context, episode);
        const saved = findProgress(progress, 'episode', episode.id);
        return (
          <View key={episode.id} style={styles.episode}>
            <FocusButton label={`${episode.episodeNumber ?? '•'}. ${episode.title}`} testID={`episode-${episode.id}`}
              accessibilityLabel={`Play ${episode.title}`} style={styles.episodeButton}
              onPress={() => navStore.getState().push({ name: 'player', target })} />
            <Text style={styles.episodeMeta}>
              {[formatDuration(episode.durationSeconds), saved && saved.durationSeconds > 0 ? `${Math.round((saved.positionSeconds / saved.durationSeconds) * 100)}% watched` : null].filter(Boolean).join(' · ')}
            </Text>
            <DownloadButton target={target} />
          </View>
        );
      })}
    </View>
  );
}

/** "Version / Stream Quality": opens a list of variants (best first). */
function VariantPicker({ master, value }: { master: MasterDetails; value: VariantInfo }) {
  const [open, setOpen] = useState(false);
  if (master.variants.length < 2) return null;
  const choose = (streamId: string) => {
    stores.library.getState().selectVariant(master.id, streamId);
    setOpen(false);
  };
  return (
    <>
      <FocusButton label={`Version: ${value.label}`} onPress={() => setOpen(true)} testID="variant-button" />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalPanel} accessibilityLabel="Version / Stream Quality">
            <Text style={styles.modalTitle}>Version / Stream Quality</Text>
            {master.variants.map((variant, index) => (
              <FocusButton key={variant.streamId} label={`${variant.label}${index === 0 ? ' (best)' : ''}`} hasTVPreferredFocus={variant.streamId === value.streamId}
                variant={variant.streamId === value.streamId ? 'primary' : 'ghost'} onPress={() => choose(variant.streamId)} />
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Layout({ backdrop, title, children }: { backdrop: string | null | undefined; title: string; children: React.ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="details-screen">
      {backdrop ? <Image source={{ uri: backdrop }} style={styles.backdrop} resizeMode="cover" /> : null}
      <View style={styles.shade} />
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {children}
    </ScrollView>
  );
}

function Facts({ year, rating, quality, extra }: { year: number | null; rating: number | null | undefined; quality: string | null; extra?: string | null }) {
  return (
    <View style={styles.facts}>
      {rating != null ? <Text style={styles.rating}>{Math.round(rating * 10)}% rating</Text> : null}
      {year ? <Text style={styles.fact}>{year}</Text> : null}
      {extra ? <Text style={styles.fact}>{extra}</Text> : null}
      {quality ? <Text style={styles.quality}>{quality}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: safe.horizontal, paddingTop: 120, paddingBottom: spacing.xl },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 320, opacity: 0.6 },
  shade: { position: 'absolute', top: 160, left: 0, right: 0, height: 160, backgroundColor: 'rgba(20,20,20,0.6)' },
  title: { color: colors.strong, fontSize: fonts.hero, fontWeight: '900', marginBottom: spacing.sm },
  facts: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  rating: { color: colors.success, fontWeight: '700', fontSize: fonts.body },
  fact: { color: colors.text, fontSize: fonts.body },
  quality: { color: colors.text, borderWidth: 1, borderColor: colors.muted, paddingHorizontal: 6, fontSize: fonts.small },
  plot: { color: colors.text, fontSize: fonts.body, maxWidth: 620, marginBottom: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  episodes: { marginTop: spacing.md },
  episode: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  episodeButton: { minWidth: 360 },
  episodeMeta: { color: colors.muted, fontSize: fonts.small, flex: 1 },
  modalScrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  modalPanel: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: 8, gap: spacing.sm, minWidth: 360 },
  modalTitle: { color: colors.strong, fontSize: fonts.heading, fontWeight: '700', marginBottom: spacing.sm },
});
