import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import { episodeLabel, type MergedEpisode, type MergedSeries, type VariantInfo } from '@iptv/shared';
import type { PlayerTrack } from '../../modules/tv-media';
import { FocusButton } from '../components/FocusButton';
import { colors, fonts, spacing } from '../theme';

type Tab = 'audio' | 'subtitles' | 'versions' | 'episodes';

interface QuickDrawerProps {
  tracks: PlayerTrack[];
  variants: VariantInfo[];
  currentStreamId: string;
  /** All versions' episodes (D-066). */
  series: MergedSeries | null;
  onTrack(type: 'audio' | 'text', groupIndex: number, trackIndex: number): void;
  onVariant(variant: VariantInfo): void;
  onEpisode(episode: MergedEpisode): void;
}

/** Up/Down in the player: Audio, Subtitles, Versions, Episodes. Focus is trapped inside; Back closes. */
export function QuickDrawer({ tracks, variants, currentStreamId, series, onTrack, onVariant, onEpisode }: QuickDrawerProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'audio', label: 'Audio' },
    { id: 'subtitles', label: 'Subtitles' },
    ...(variants.length > 1 ? [{ id: 'versions' as const, label: 'Versions' }] : []),
    ...(series ? [{ id: 'episodes' as const, label: 'Episodes' }] : []),
  ];
  const [tab, setTab] = useState<Tab>('audio');
  const audio = tracks.filter((t) => t.type === 'audio');
  const text = tracks.filter((t) => t.type === 'text');

  return (
    <TVFocusGuideView style={styles.drawer} trapFocusUp trapFocusDown trapFocusLeft trapFocusRight testID="quick-drawer">
      <View style={styles.tabs}>
        {tabs.map((t, index) => (
          <FocusButton
            key={t.id}
            label={t.label}
            hasTVPreferredFocus={index === 0}
            variant={tab === t.id ? 'primary' : 'ghost'}
            onPress={() => setTab(t.id)}
            onFocus={() => setTab(t.id)}
          />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.options}>
        {tab === 'audio' ? (
          audio.length === 0 ? (
            <Text style={styles.muted}>Default audio</Text>
          ) : (
            audio.map((t) => (
              <FocusButton
                key={`${t.groupIndex}-${t.trackIndex}`}
                label={`${t.selected ? '✓ ' : ''}${t.label}`}
                variant="ghost"
                onPress={() => onTrack('audio', t.groupIndex, t.trackIndex)}
              />
            ))
          )
        ) : null}
        {tab === 'subtitles' ? (
          <>
            <FocusButton label={`${text.some((t) => t.selected) ? '' : '✓ '}Off`} variant="ghost" onPress={() => onTrack('text', -1, 0)} />
            {text.map((t) => (
              <FocusButton
                key={`${t.groupIndex}-${t.trackIndex}`}
                label={`${t.selected ? '✓ ' : ''}${t.label}`}
                variant="ghost"
                onPress={() => onTrack('text', t.groupIndex, t.trackIndex)}
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
