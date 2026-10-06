import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TVFocusGuideView } from 'react-native';
import { audioTrackLabels, episodeLabel, trackLabel, type MergedEpisode, type MergedSeries, type VariantInfo, t } from '@iptv/shared';
import type { PlayerTrack } from '../../modules/tv-media';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts, spacing } from '../theme';
import { FocusRow } from '../components/FocusRow';

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
}

/** Up/Down in the player: Audio, Subtitles, Versions, Episodes. Focus is trapped inside; Back closes. */
export function QuickDrawer({ tracks, variants, currentStreamId, series, onTrack, onVariant, onEpisode, initialTab }: QuickDrawerProps) {
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

  return (
    <TVFocusGuideView style={styles.drawer} trapFocusUp trapFocusDown trapFocusLeft trapFocusRight testID="quick-drawer">
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
        {tab === 'episodes' && series
          ? series.seasons
              .flatMap((season) => season.episodes)
              .map((e) => (
                <FocusButton
                  key={e.id}
                  label={`${e.id === currentStreamId ? '▶ ' : ''}${episodeLabel(e)} · ${e.title}`}
                  variant="ghost"
                  onPress={() => onEpisode(e)}
                />
              ))
          : null}
      </ScrollView>
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: 'rgba(20,20,20,0.96)', padding: spacing.lg },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  options: { gap: spacing.sm, paddingBottom: spacing.xl },
  muted: { color: colors.muted, fontSize: fonts.body },
});
