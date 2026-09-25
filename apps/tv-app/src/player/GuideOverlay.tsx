import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TVFocusGuideView,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  floorToSlot,
  formatGuideTime,
  formatProgrammeTime,
  programmeAt,
  programmeProgress,
  useEpgGuide,
  useNow,
  type EpgChannelRow,
  type EpgListing,
  type LiveChannel,
} from '@iptv/shared';
import { stores } from '../appContext';
import { useCatalog } from '../hooks';
import { colors, fonts, radius, spacing } from '../theme';

/** The overlay closes after this long without a key press, focus change or scroll (D-058). */
export const GUIDE_HIDE_MS = 6000;
/** Now and next are enough; the Live TV page has the full grid. */
const GUIDE_HOURS = 3;

interface GuideOverlayProps {
  channelId: string;
  categoryId: string | null;
  onSelect(channel: LiveChannel, programme: EpgListing | null): void;
  onClose(): void;
}

/**
 * Live TV guide over the playing channel: channels of the same category with what is on now and next. The video keeps
 * playing underneath. D-pad: ↑/↓ move, Select switches channel, Back closes. Phones: tap a channel, tap beside the
 * panel to close. Closes by itself after GUIDE_HIDE_MS without input. See DECISIONS.md#d-058.
 */
export function GuideOverlay({ channelId, categoryId, onSelect, onClose }: GuideOverlayProps) {
  const now = useNow();
  const [from] = useState(() => floorToSlot(Date.now()));
  const guide = useEpgGuide(stores.epg, { categoryId, from, hours: GUIDE_HOURS });
  const category = useCatalog((s) => s.categories.live?.data?.find((c) => c.id === categoryId)?.name);
  const { width } = useWindowDimensions();

  // Any input restarts the countdown; the overlay never closes while the user is moving through it.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onClose, GUIDE_HIDE_MS);
  }, [onClose]);
  useEffect(() => {
    poke();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poke]);

  return (
    <View style={StyleSheet.absoluteFill} testID="guide-overlay">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} focusable={false} accessibilityLabel="Close guide" />
      <TVFocusGuideView
        style={[styles.panel, { width: Math.min(560, Math.max(320, width * 0.5)) }]}
        trapFocusUp
        trapFocusDown
        trapFocusLeft
        trapFocusRight
      >
        <View style={styles.header}>
          <Text style={styles.heading} numberOfLines={1}>
            {category ?? 'All channels'}
          </Text>
          <Text style={styles.clock}>{formatGuideTime(now)}</Text>
        </View>
        {guide.rows.length === 0 ? (
          guide.loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} accessibilityLabel="Loading guide" />
          ) : (
            <Text style={styles.muted}>{guide.error ? 'The guide could not be loaded.' : 'No channels in this category.'}</Text>
          )
        ) : (
          <ScrollView contentContainerStyle={styles.list} onScrollBeginDrag={poke}>
            {guide.rows.map((row) => (
              <GuideRow
                key={row.channel.id}
                row={row}
                now={now}
                current={row.channel.id === channelId}
                onFocus={poke}
                onPress={(programme) => onSelect(row.channel, programme)}
              />
            ))}
          </ScrollView>
        )}
      </TVFocusGuideView>
    </View>
  );
}

function GuideRow({
  row,
  now,
  current,
  onFocus,
  onPress,
}: {
  row: EpgChannelRow;
  now: number;
  current: boolean;
  onFocus(): void;
  onPress(programme: EpgListing | null): void;
}) {
  const [focused, setFocused] = useState(false);
  const { channel, programmes } = row;
  const onNow = programmeAt(programmes, now);
  const next = programmes.find((p) => Date.parse(p.start) >= (onNow ? Date.parse(onNow.end) : now)) ?? null;
  return (
    <Pressable
      testID={`guide-channel-${channel.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${channel.name}${onNow ? `, now: ${onNow.title}` : ''}${current ? ', playing' : ''}`}
      accessibilityState={{ selected: current }}
      hasTVPreferredFocus={current}
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => setFocused(false)}
      onPress={() => onPress(onNow)}
      style={[styles.row, current && styles.rowCurrent, focused && styles.rowFocused]}
    >
      <View style={styles.logo}>
        {channel.logoUrl ? (
          <Image source={{ uri: channel.logoUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <Text style={styles.number}>{channel.number ?? channel.name.charAt(0)}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.channel} numberOfLines={1}>
          {channel.number ? `${channel.number}  ` : ''}
          {channel.name}
          {current ? <Text style={styles.playing}> ● Playing</Text> : null}
        </Text>
        {onNow ? (
          <>
            <Text style={styles.now} numberOfLines={1}>
              {formatProgrammeTime(onNow)} · {onNow.title}
            </Text>
            <View style={styles.track}>
              <View style={[styles.value, { width: `${Math.round(programmeProgress(onNow, now) * 100)}%` }]} />
            </View>
          </>
        ) : (
          <Text style={styles.muted}>No guide information</Text>
        )}
        {next ? (
          <Text style={styles.next} numberOfLines={1}>
            Next {formatGuideTime(Date.parse(next.start))} · {next.title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // See-through so the channel stays visible behind the list.
  panel: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)', paddingTop: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  heading: { color: colors.strong, fontSize: fonts.body, fontWeight: '700', flexShrink: 1 },
  clock: { color: colors.muted, fontSize: fonts.small, fontVariant: ['tabular-nums'] },
  loading: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xl, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowCurrent: { backgroundColor: 'rgba(255,255,255,0.08)' },
  rowFocused: { borderColor: colors.strong, backgroundColor: 'rgba(255,255,255,0.16)' },
  logo: { width: 56, height: 40, alignItems: 'center', justifyContent: 'center' },
  number: { color: colors.muted, fontSize: fonts.body, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  channel: { color: colors.strong, fontSize: fonts.small, fontWeight: '700' },
  playing: { color: colors.accent, fontWeight: '700' },
  now: { color: colors.text, fontSize: fonts.small },
  next: { color: colors.muted, fontSize: fonts.tiny },
  muted: { color: colors.muted, fontSize: fonts.small, paddingHorizontal: spacing.lg },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 2 },
  value: { height: 3, backgroundColor: colors.accent },
});
