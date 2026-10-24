import { useState } from 'react';
// Read through the namespace: React Native Web (desktop) has no TVFocusGuideView, and a named import of it fails there.
import * as ReactNative from 'react-native';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { episodeLabel, type MergedEpisode, type MergedSeries, type VariantInfo, t } from '@iptv/shared';
import { FocusButton } from './ui/FocusButton';
import { IconButton } from './ui/IconButton';
import { colors, fonts, spacing } from './ui/theme';
import { FocusRow } from './ui/FocusRow';
import { Select } from './ui/Select';

/** An audio or subtitle track as the app's player lists it, named for people (`audioTrackLabels`, `trackLabel`). */
export interface TrackOption {
  key: string;
  label: string;
  selected: boolean;
  pick(): void;
}

export type DrawerTab = 'audio' | 'subtitles' | 'versions' | 'episodes';

interface QuickDrawerProps {
  audio: TrackOption[];
  subtitles: TrackOption[];
  /** Subtitles → Off; selected while no subtitle track is. */
  subtitlesOff(): void;
  variants: VariantInfo[];
  currentStreamId: string;
  /** All versions' episodes (D-066). */
  series: MergedSeries | null;
  onVariant(variant: VariantInfo): void;
  onEpisode(episode: MergedEpisode): void;
  /** The tab it opens on: Episodes from the player's episodes button, Audio otherwise. */
  initialTab?: DrawerTab;
  /** Phones: the back arrow or a tap beside the drawer closes it (TV: the remote's Back). */
  onClose(): void;
}

/**
 * The player's Audio, Subtitles, Versions and Episodes panel, the same on every app (issue #237, DECISIONS.md#d-210).
 * TV: Up/Down in the player open it; focus is trapped inside and Back closes it. Phones have no Back key on screen (the
 * navigation bar is hidden), so they get a back arrow and a tap beside the drawer closes it; so does the desktop, where
 * Escape also closes it (the player's keys).
 */
export function QuickDrawer({
  audio,
  subtitles,
  subtitlesOff,
  variants,
  currentStreamId,
  series,
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
  const phone = !Platform.isTV;
  const web = Platform.OS === 'web';

  // The episode playing; it may play from another version than the merged list's default one (D-066).
  const isCurrent = (episode: MergedEpisode) =>
    episode.id === currentStreamId || episode.versions.some((version) => version.episode.id === currentStreamId);
  // One season at a time, the one playing first, like the details page and the desktop player.
  const [seasonNumber, setSeasonNumber] = useState(
    () => series?.seasons.find((s) => s.episodes.some(isCurrent))?.number ?? series?.seasons[0]?.number ?? 1,
  );
  const season = series?.seasons.find((s) => s.number === seasonNumber) ?? series?.seasons[0];

  const { TVFocusGuideView } = ReactNative;
  const Trap = TVFocusGuideView ?? View;
  return (
    <>
      {phone ? (
        <Pressable
          style={[StyleSheet.absoluteFill, web && styles.webLayer]}
          accessibilityLabel={t('Close')}
          testID="quick-drawer-backdrop"
          onPress={onClose}
        />
      ) : null}
      <Trap
        style={[styles.drawer, web && styles.webDrawer]}
        testID="quick-drawer"
        {...(web
          ? { role: 'dialog' as const, accessibilityLabel: first === 'episodes' ? t('Episodes') : t('Audio, subtitles and version') }
          : { trapFocusUp: true, trapFocusDown: true, trapFocusLeft: true, trapFocusRight: true })}
      >
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
              audio.map((track) => (
                <FocusButton key={track.key} label={`${track.selected ? '✓ ' : ''}${track.label}`} variant="ghost" onPress={track.pick} />
              ))
            )
          ) : null}
          {tab === 'subtitles' ? (
            <>
              <FocusButton
                label={`${subtitles.some((track) => track.selected) ? '' : '✓ '}${t('Off')}`}
                variant="ghost"
                onPress={subtitlesOff}
              />
              {subtitles.map((track) => (
                <FocusButton key={track.key} label={`${track.selected ? '✓ ' : ''}${track.label}`} variant="ghost" onPress={track.pick} />
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
      </Trap>
    </>
  );
}

const styles = StyleSheet.create({
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: 'rgba(20,20,20,0.96)', padding: spacing.lg },
  // Over the desktop player's controls; no wider than a narrow window.
  webDrawer: { zIndex: 5, maxWidth: '100%' },
  webLayer: { zIndex: 5 },
  header: { flexDirection: 'row', marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  options: { gap: spacing.sm, paddingBottom: spacing.xl },
  muted: { color: colors.muted, fontSize: fonts.body },
  season: { flexDirection: 'row' },
  // Disabled buttons fade; the episode playing stays bright.
  current: { opacity: 1 },
});
