import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import { audioTrackLabels, episodeLabel, trackLabel, type MergedEpisode, type MergedSeries, type VariantInfo, t } from '@iptv/shared';
import type { PlayerTrack } from '../../modules/tv-media';
import { FocusButton } from '../components/FocusButton';
import { IconButton } from '../components/IconButton';
import { colors, fonts, spacing } from '../theme';
import { FocusRow } from '../components/FocusRow';
import { Select } from '../components/Select';

export type DrawerTab = 'audio' | 'subtitles' | 'versions' | 'episodes';

interface QuickDrawerProps {
  tracks: PlayerTrack[];
  variants: VariantInfo[];
  currentStreamId: string;
  /** All versions' episodes (D-066). */
  series: MergedSeries | null;
  onTrack(type: 'audio' | 'text', groupIndex: number, trackIndex: number): void;
  onVariant(variant: VariantInfo): void;
  onEpisode(episode: MergedEpisode): void;
  /** The tab it opens on: Episodes from the player's episodes button, Audio otherwise. */
  initialTab?: DrawerTab;
  /** Phones: the back arrow or a tap beside the drawer closes it (TV: the remote's Back). */
  onClose(): void;
}

/**
 * Up/Down in the player: Audio, Subtitles, Versions, Episodes. Focus is trapped inside; Back closes. Phones have no
 * Back key on screen (the navigation bar is hidden), so they get a back arrow and a tap beside the drawer closes it.
 */
export function QuickDrawer({
  tracks,
  variants,
  currentStreamId,
  series,
  onTrack,
  onVariant,
  onEpisode,
  initialTab,
  onClose,
}: QuickDrawerProps) {
  const tabs: { id: DrawerTab; label: string }[] = [
    { id: 'audio', label: t('Audio') },
    { id: 'subtitles', label: t('Subtitles') },
    ...(variants.length > 1 ? [{ id: 'versions' as const, label: t('Versions') }] : []),
    ...(series ? [{ id: 'episodes' as const, label: t('Episodes') }] : []),
  ];
  const first = tabs.find((entry) => entry.id === initialTab)?.id ?? 'audio';
  const [tab, setTab] = useState<DrawerTab>(first);
  const audio = tracks.filter((track) => track.type === 'audio');
  const audioLabels = audioTrackLabels(audio);
  const text = tracks.filter((track) => track.type === 'text');

  const phone = !Platform.isTV;

  // The episode playing; it may play from another version than the merged list's default one (D-066).
  const isCurrent = (episode: MergedEpisode) =>
    episode.id === currentStreamId || episode.versions.some((version) => version.episode.id === currentStreamId);
  // One season at a time, the one playing first, like the details page and the desktop player.
  const [seasonNumber, setSeasonNumber] = useState(
    () => series?.seasons.find((s) => s.episodes.some(isCurrent))?.number ?? series?.seasons[0]?.number ?? 1,
  );
  const season = series?.seasons.find((s) => s.number === seasonNumber) ?? series?.seasons[0];

  return (
    <>
      {phone ? (
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('Close')} testID="quick-drawer-backdrop" onPress={onClose} />
      ) : null}
      <TVFocusGuideView style={styles.drawer} trapFocusUp trapFocusDown trapFocusLeft trapFocusRight testID="quick-drawer">
        {phone ? (
          <View style={styles.header}>
            <IconButton icon="back" label={t('Back')} plain size={44} iconSize={28} testID="quick-drawer-back" onPress={onClose} />
          </View>
        ) : null}
        <FocusRow style={styles.tabs}>
          {tabs.map((entry) => (
            <FocusButton
              key={entry.id}
              label={entry.label}
              hasTVPreferredFocus={entry.id === first}
              variant={tab === entry.id ? 'primary' : 'ghost'}
              onPress={() => setTab(entry.id)}
              onFocus={() => setTab(entry.id)}
            />
          ))}
        </FocusRow>
        <ScrollView contentContainerStyle={styles.options}>
          {tab === 'audio' ? (
            audio.length === 0 ? (
              <Text style={styles.muted}>{t('Default audio')}</Text>
            ) : (
              audio.map((track, index) => (
                <FocusButton
                  key={`${track.groupIndex}-${track.trackIndex}`}
                  label={`${track.selected ? '✓ ' : ''}${audioLabels[index]}`}
                  variant="ghost"
                  onPress={() => onTrack('audio', track.groupIndex, track.trackIndex)}
                />
              ))
            )
          ) : null}
          {tab === 'subtitles' ? (
            <>
              <FocusButton
                label={`${text.some((track) => track.selected) ? '' : '✓ '}${t('Off')}`}
                variant="ghost"
                onPress={() => onTrack('text', -1, 0)}
              />
              {text.map((track) => (
                <FocusButton
                  key={`${track.groupIndex}-${track.trackIndex}`}
                  label={`${track.selected ? '✓ ' : ''}${trackLabel(track)}`}
                  variant="ghost"
                  onPress={() => onTrack('text', track.groupIndex, track.trackIndex)}
                />
              ))}
            </>
          ) : null}
          {tab === 'versions'
            ? variants.map((v) => (
                <FocusButton
                  key={v.streamId}
                  label={`${v.streamId === currentStreamId ? '✓ ' : ''}${v.label}`}
                  variant="ghost"
                  onPress={() => onVariant(v)}
                />
              ))
            : null}
          {tab === 'episodes' && series && series.seasons.length > 1 && season ? (
            <View style={styles.season}>
              <Select
                compact
                label={t('Season')}
                value={String(season.number)}
                options={series.seasons.map((s) => ({ value: String(s.number), label: s.name }))}
                onChange={(value) => setSeasonNumber(Number(value))}
                testID="quick-drawer-season"
              />
            </View>
          ) : null}
          {tab === 'episodes' && season
            ? season.episodes.map((e) =>
                isCurrent(e) ? (
                  // The one playing: marked and read-only.
                  <FocusButton
                    key={e.id}
                    label={`▶ ${episodeLabel(e)} · ${e.title}`}
                    variant="accent"
                    disabled
                    style={styles.current}
                    testID="quick-drawer-current-episode"
                    onPress={() => undefined}
                  />
                ) : (
                  <FocusButton key={e.id} label={`${episodeLabel(e)} · ${e.title}`} variant="ghost" onPress={() => onEpisode(e)} />
                ),
              )
            : null}
        </ScrollView>
      </TVFocusGuideView>
    </>
  );
}

const styles = StyleSheet.create({
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: 'rgba(20,20,20,0.96)', padding: spacing.lg },
  header: { flexDirection: 'row', marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  options: { gap: spacing.sm, paddingBottom: spacing.xl },
  muted: { color: colors.muted, fontSize: fonts.body },
  season: { flexDirection: 'row' },
  // Disabled buttons fade; the episode playing stays bright.
  current: { opacity: 1 },
});
