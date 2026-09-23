import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  EPG_SLOT_MS,
  floorToSlot,
  formatGuideTime,
  formatProgrammeTime,
  guideSlots,
  layoutGuideRow,
  nowFraction,
  programmeAt,
  programmeProgress,
  useEpgGuide,
  useNow,
  type EpgChannelRow,
  type EpgListing,
  type LiveChannel,
} from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { ErrorText, errorText, Loading } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { useCatalog } from '../hooks';
import { colors, fonts, safe, spacing } from '../theme';

/** 2 hours fit 960 dp with readable titles. The backend caches now −3 h … +48 h (DECISIONS.md#d-031). */
const HOURS = 2;
const STEP_MS = 2 * EPG_SLOT_MS;
const MIN_BACK_MS = 3 * 3600_000;
const MAX_AHEAD_MS = 46 * 3600_000;
const CHANNEL_WIDTH = 170;
const ROW_HEIGHT = 56;

interface Selection {
  channel: LiveChannel;
  programme: EpgListing | null;
}

function play(channel: LiveChannel, programme: EpgListing | null) {
  navStore.getState().push({
    name: 'player',
    target: {
      kind: 'live',
      streamId: channel.id,
      container: 'm3u8',
      title: channel.name,
      subtitle: programme?.title ?? null,
      posterUrl: channel.logoUrl,
    },
  });
}

/** Live TV guide: channel × time grid driven by the D-pad; the focused programme is described on top. See DECISIONS.md#d-032. */
export function LiveScreen() {
  const categories = useCatalog((s) => s.categories.live?.data ?? []);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const now = useNow();
  const [from, setFrom] = useState(() => floorToSlot(Date.now()));
  const [pages, setPages] = useState(1);
  const [focused, setFocused] = useState<Selection | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const guide = useEpgGuide(stores.epg, { categoryId, from, hours: HOURS }, pages);
  const to = from + HOURS * 3600_000;
  const nowSlot = floorToSlot(now);
  const timelineWidth = Math.max(0, gridWidth - CHANNEL_WIDTH);

  useEffect(() => {
    void stores.catalog.getState().loadCategories('live');
  }, []);

  const chooseCategory = (id: string | null) => {
    setCategoryId(id);
    setPages(1);
    setFocused(null);
  };

  // Before anything is focused, describe what is on now on the first channel.
  const first = guide.rows[0];
  const described = focused ?? (first ? { channel: first.channel, programme: programmeAt(first.programmes, now) } : null);
  const nowAt = nowFraction(now, from, to);

  return (
    <View style={styles.screen} testID="live-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Live TV</Text>
        <View style={styles.chips}>
          <FocusButton label="All" variant={categoryId === null ? 'primary' : 'ghost'} onPress={() => chooseCategory(null)} />
          {categories.map((c) => (
            <FocusButton
              key={c.id}
              label={c.name}
              variant={categoryId === c.id ? 'primary' : 'ghost'}
              onPress={() => chooseCategory(c.id)}
            />
          ))}
        </View>
      </View>

      <ProgrammeInfo selection={described} now={now} />

      <View style={styles.toolbar}>
        <FocusButton
          label="◀ Earlier"
          variant="ghost"
          disabled={from - STEP_MS < nowSlot - MIN_BACK_MS}
          onPress={() => setFrom(from - STEP_MS)}
        />
        <FocusButton label="Now" variant="ghost" disabled={from === nowSlot} onPress={() => setFrom(nowSlot)} />
        <FocusButton
          label="Later ▶"
          variant="ghost"
          disabled={from + STEP_MS > nowSlot + MAX_AHEAD_MS}
          onPress={() => setFrom(from + STEP_MS)}
          testID="guide-later"
        />
        <Text style={styles.day}>{new Date(from).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
      </View>

      {guide.status === 'refreshing' ? <Text style={styles.notice}>Downloading the TV guide…</Text> : null}
      {guide.status === 'unavailable' ? (
        <Text style={styles.notice}>Your provider has no full TV guide. Showing what is available per channel.</Text>
      ) : null}
      {guide.error ? <ErrorText>{errorText(guide.error)}</ErrorText> : null}

      <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)} testID="guide">
        {timelineWidth > 0 ? <TimeHeader from={from} to={to} width={timelineWidth} /> : null}
        {guide.loading && guide.rows.length === 0 ? <Loading /> : null}
        {timelineWidth > 0 ? (
          <FlatList
            data={guide.rows}
            keyExtractor={(row) => row.channel.id}
            renderItem={({ item, index }) => (
              <GuideRow row={item} from={from} to={to} now={now} width={timelineWidth} preferred={index === 0} onFocus={setFocused} />
            )}
            onEndReached={() => {
              if (!guide.loading && guide.rows.length < guide.totalChannels) setPages(pages + 1);
            }}
            onEndReachedThreshold={0.5}
          />
        ) : null}
        {nowAt != null && timelineWidth > 0 ? (
          <View pointerEvents="none" style={[styles.nowLine, { left: CHANNEL_WIDTH + nowAt * timelineWidth }]} />
        ) : null}
      </View>
    </View>
  );
}

function TimeHeader({ from, to, width }: { from: number; to: number; width: number }) {
  const slots = useMemo(() => guideSlots(from, to), [from, to]);
  return (
    <View style={styles.timeHeader}>
      <View style={{ width: CHANNEL_WIDTH }} />
      <View style={{ width }}>
        {slots.map((slot) => (
          <Text key={slot} style={[styles.slot, { left: ((slot - from) / (to - from)) * width }]}>
            {formatGuideTime(slot)}
          </Text>
        ))}
      </View>
    </View>
  );
}

interface GuideRowProps {
  row: EpgChannelRow;
  from: number;
  to: number;
  now: number;
  width: number;
  preferred: boolean;
  onFocus(selection: Selection): void;
}

function GuideRow({ row, from, to, now, width, preferred, onFocus }: GuideRowProps) {
  const { channel, programmes } = row;
  const cells = layoutGuideRow(programmes, from, to);
  return (
    <View style={styles.row}>
      <GuideCellButton
        style={styles.channel}
        testID={`guide-channel-${channel.id}`}
        label={`Watch ${channel.name}`}
        onPress={() => play(channel, programmeAt(programmes, now))}
        onFocus={() => onFocus({ channel, programme: programmeAt(programmes, now) })}
      >
        {channel.logoUrl ? (
          <Image source={{ uri: channel.logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logo} />
        )}
        <Text style={styles.channelName} numberOfLines={2}>
          {channel.number != null ? `${channel.number}  ` : ''}
          {channel.name}
        </Text>
      </GuideCellButton>
      <View style={[styles.timeline, { width }]}>
        {cells.map((cell) => {
          const cellWidth = cell.width * width;
          if (!cell.programme) {
            return (
              <View key={`gap-${cell.startMs}`} style={[styles.gap, { width: cellWidth }]}>
                {programmes.length === 0 ? (
                  <Text style={styles.gapText} numberOfLines={1}>
                    No guide information
                  </Text>
                ) : null}
              </View>
            );
          }
          const programme = cell.programme;
          const onNow = cell.startMs <= now && now < Date.parse(programme.end);
          const past = Date.parse(programme.end) <= now;
          return (
            <GuideCellButton
              key={programme.start}
              testID={onNow ? `guide-now-${channel.id}` : undefined}
              label={`${programme.title}, ${formatProgrammeTime(programme)}, ${channel.name}`}
              hasTVPreferredFocus={preferred && onNow}
              style={[styles.programme, { width: cellWidth }, onNow && styles.programmeNow, past && styles.programmePast]}
              onPress={() => play(channel, onNow ? programme : null)}
              onFocus={() => onFocus({ channel, programme })}
            >
              <Text style={styles.programmeTitle} numberOfLines={1}>
                {cell.clippedStart ? '‹ ' : ''}
                {programme.title}
              </Text>
              <Text style={styles.programmeTime} numberOfLines={1}>
                {formatProgrammeTime(programme)}
              </Text>
            </GuideCellButton>
          );
        })}
      </View>
    </View>
  );
}

interface GuideCellButtonProps {
  label: string;
  onPress(): void;
  onFocus(): void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  hasTVPreferredFocus?: boolean;
  children: ReactNode;
}

/** Focusable guide block: white border when focused (Android focus search moves by geometry). */
function GuideCellButton({ label, onPress, onFocus, style, testID, hasTVPreferredFocus, children }: GuideCellButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => setFocused(false)}
      style={[style, focused && styles.focused]}
    >
      {children}
    </Pressable>
  );
}

function ProgrammeInfo({ selection, now }: { selection: Selection | null; now: number }) {
  const programme = selection?.programme ?? null;
  const onNow = programme ? Date.parse(programme.start) <= now && now < Date.parse(programme.end) : false;
  return (
    <View style={styles.info} testID="guide-info">
      {selection ? (
        <>
          <Text style={styles.infoTitle} numberOfLines={1}>
            {programme?.title ?? selection.channel.name}
          </Text>
          <Text style={styles.infoMeta} numberOfLines={1}>
            {selection.channel.name}
            {programme ? ` · ${formatProgrammeTime(programme)}` : ''}
            {onNow ? ' · On now' : ''}
          </Text>
          {programme && onNow ? (
            <View style={styles.infoBar}>
              <View style={[styles.infoFill, { width: `${Math.round(programmeProgress(programme, now) * 100)}%` }]} />
            </View>
          ) : null}
          {programme?.description ? (
            <Text style={styles.infoText} numberOfLines={2}>
              {programme.description}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical, paddingHorizontal: safe.horizontal },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.sm },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  info: { height: 96, justifyContent: 'center' },
  infoTitle: { color: colors.strong, fontSize: fonts.heading, fontWeight: '700' },
  infoMeta: { color: colors.muted, fontSize: fonts.small, marginTop: 2 },
  infoBar: { height: 3, width: 240, marginTop: spacing.xs, backgroundColor: 'rgba(255,255,255,0.2)' },
  infoFill: { height: 3, backgroundColor: colors.accent },
  infoText: { color: colors.text, fontSize: fonts.small, marginTop: spacing.xs, maxWidth: 640 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  day: { color: colors.muted, fontSize: fonts.small, marginLeft: 'auto' },
  notice: { color: colors.muted, fontSize: fonts.small, marginBottom: spacing.xs },
  grid: { flex: 1 },
  timeHeader: { flexDirection: 'row', height: 22 },
  slot: { position: 'absolute', color: colors.muted, fontSize: fonts.small, paddingLeft: spacing.xs },
  row: { flexDirection: 'row', height: ROW_HEIGHT, marginBottom: 2 },
  channel: {
    width: CHANNEL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 4,
  },
  logo: { width: 40, height: 40 },
  channelName: { flex: 1, color: colors.text, fontSize: fonts.small },
  timeline: { flexDirection: 'row' },
  programme: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.raised,
    borderWidth: 2,
    borderColor: colors.bg,
    borderRadius: 4,
  },
  programmeNow: { backgroundColor: '#3a3a3a' },
  programmePast: { opacity: 0.55 },
  programmeTitle: { color: colors.strong, fontSize: fonts.small, fontWeight: '700' },
  programmeTime: { color: colors.muted, fontSize: 11 },
  gap: { height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: spacing.sm },
  gapText: { color: colors.muted, fontSize: fonts.small },
  focused: { borderColor: colors.strong, backgroundColor: '#4a4a4a' },
  nowLine: { position: 'absolute', top: 22, bottom: 0, width: 2, backgroundColor: colors.accent },
});
