import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import { RECENT_CHANNELS_IN_PLAYER, type RecentChannel, t } from '@iptv/shared';
import { useRecentChannels } from '../hooks';
import { useRemote } from '../tv/remote';
import { colors, fonts, radius, spacing } from '../theme';

/** The strip closes after this long without a key press or focus change, like the guide (D-058). */
export const RECENT_HIDE_MS = 6000;

interface RecentChannelsOverlayProps {
  channelId: string;
  onSelect(channel: RecentChannel): void;
  /** ↓ below the channels: the player's buttons (Play/Pause, audio and subtitles). */
  onMore(): void;
  onClose(): void;
}

/**
 * Live TV, ↓ (issue #122, D-129): the last channels watched, in a see-through strip over the playing channel.
 * ←/→ move, Select switches channel, ↓ again goes on to the player's buttons, ↑ or Back closes. Closes by itself after
 * RECENT_HIDE_MS without input.
 */
export function RecentChannelsOverlay({ channelId, onSelect, onMore, onClose }: RecentChannelsOverlayProps) {
  const channels = useRecentChannels(RECENT_CHANNELS_IN_PLAYER);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onClose, RECENT_HIDE_MS);
  }, [onClose]);
  useEffect(() => {
    poke();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poke]);
  useRemote(({ key, action }) => {
    if (action === 'up') return;
    poke();
    if (key === 'up') onClose();
  });

  return (
    <View style={styles.root} pointerEvents="box-none" testID="recent-channels">
      <TVFocusGuideView style={styles.panel} trapFocusUp trapFocusLeft trapFocusRight>
        <Text style={styles.heading}>{t('Recently watched channels')}</Text>
        {channels.length === 0 ? (
          <Text style={styles.muted}>{t('No channels watched yet.')}</Text>
        ) : (
          <ScrollView horizontal contentContainerStyle={styles.list} showsHorizontalScrollIndicator={false}>
            {channels.map((channel, index) => (
              <ChannelTile
                key={channel.id}
                channel={channel}
                current={channel.id === channelId}
                // The previous channel first: one press of Select goes back to it.
                preferred={channels.length > 1 ? index === 1 : index === 0}
                onFocus={poke}
                onPress={() => onSelect(channel)}
              />
            ))}
          </ScrollView>
        )}
        {/* Reached with ↓ from the channels: focusing it opens the player's buttons. */}
        <Pressable
          testID="recent-channels-more"
          accessibilityRole="button"
          accessibilityLabel={t('Player controls')}
          hasTVPreferredFocus={channels.length === 0}
          onFocus={channels.length ? onMore : undefined}
          onPress={onMore}
          style={styles.more}
        >
          <Text style={styles.moreText}>▾ {t('Player controls')}</Text>
        </Pressable>
      </TVFocusGuideView>
    </View>
  );
}

function ChannelTile({
  channel,
  current,
  preferred,
  onFocus,
  onPress,
}: {
  channel: RecentChannel;
  current: boolean;
  preferred: boolean;
  onFocus(): void;
  onPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={`recent-channel-${channel.id}`}
      accessibilityRole="button"
      accessibilityLabel={current ? `${channel.name}, ${t('playing')}` : channel.name}
      accessibilityState={{ selected: current }}
      hasTVPreferredFocus={preferred}
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.tile, current && styles.tileCurrent, focused && styles.tileFocused]}
    >
      <View style={styles.logo}>
        {channel.logoUrl ? (
          <Image source={{ uri: channel.logoUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <Text style={styles.initial}>{channel.name.charAt(0)}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {channel.name}
      </Text>
      {current ? <Text style={styles.playing}>● {t('Playing')}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end' },
  // See-through so the channel stays visible above the strip.
  panel: { backgroundColor: 'rgba(0,0,0,0.72)', paddingTop: spacing.md, paddingBottom: spacing.sm },
  heading: { color: colors.strong, fontSize: fonts.body, fontWeight: '700', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  muted: { color: colors.muted, fontSize: fonts.small, paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  tile: { width: 150, padding: spacing.sm, gap: 4, borderRadius: radius, alignItems: 'center' },
  tileCurrent: { backgroundColor: 'rgba(255,255,255,0.08)' },
  tileFocused: { backgroundColor: 'rgba(255,255,255,0.2)' },
  logo: { width: 96, height: 56, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.muted, fontSize: fonts.heading, fontWeight: '700' },
  name: { color: colors.strong, fontSize: fonts.small, fontWeight: '700', textAlign: 'center' },
  playing: { color: colors.accent, fontSize: fonts.tiny, fontWeight: '700' },
  more: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  moreText: { color: colors.muted, fontSize: fonts.tiny },
});
