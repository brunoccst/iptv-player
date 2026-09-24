import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
import { colors, fonts, navHeight, radius, useSizes } from '../theme';

/** Same 3-hour window as the web guide. The backend caches now −3 h … +48 h (DECISIONS.md#d-031). */
const HOURS = 3;
const STEP_MS = 2 * EPG_SLOT_MS;
const MIN_BACK_MS = 3 * 3600_000;
const MAX_AHEAD_MS = 46 * 3600_000;
const CHANNEL_WIDTH = 200;
const ROW_HEIGHT = 64;
const CATEGORY_WIDTH = 220;
/** Web `.guide__row`: the timeline keeps a readable width and scrolls sideways on narrow screens. */
const MIN_TIMELINE = 640;

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

/**
 * Same layout as the web Live TV page: category list, Earlier/Now/Later, programme details, channel × time grid.
 * TV: focusing a programme shows its details and Select plays. Phone: a tap selects it (web), "Watch live" plays. See DECISIONS.md#d-032.
 */
export function LiveScreen() {
  const categories = useCatalog((s) => s.categories.live?.data ?? []);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const now = useNow();
  const [from, setFrom] = useState(() => floorToSlot(Date.now()));
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const guide = useEpgGuide(stores.epg, { categoryId, from, hours: HOURS }, pages);
  const sizes = useSizes();
  const to = from + HOURS * 3600_000;
  const nowSlot = floorToSlot(now);
  const timelineWidth = Math.max(MIN_TIMELINE, pageWidth - CHANNEL_WIDTH);

  useEffect(() => {
    void stores.catalog.getState().loadCategories('live');
  }, []);

  const chooseCategory = (id: string | null) => {
    setCategoryId(id);
    setPages(1);
    setSelected(null);
  };

  // TV: before anything is focused, describe what is on now on the first channel.
  const first = guide.rows[0];
  const described = selected ?? (Platform.isTV && first ? { channel: first.channel, programme: programmeAt(first.programmes, now) } : null);
  const nowAt = nowFraction(now, from, to);
  const moreChannels = guide.rows.length < guide.totalChannels;

  return (
    <ScrollView
      style={styles.screen}
      testID="live-screen"
      contentContainerStyle={{ paddingTop: navHeight + 24, paddingHorizontal: sizes.gutter, paddingBottom: 60 }}
      onScroll={(event) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        if (moreChannels && !guide.loading && layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) setPages(pages + 1);
      }}
      scrollEventThrottle={200}
    >
      <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>Live TV</Text>
      <View style={styles.live}>
        <View style={styles.categories} accessibilityLabel="Channel categories">
          <CategoryItem label="All channels" active={categoryId === null} onPress={() => chooseCategory(null)} />
          {categories.map((c) => (
            <CategoryItem key={c.id} label={c.name} active={categoryId === c.id} onPress={() => chooseCategory(c.id)} />
          ))}
        </View>

        <View style={styles.page} testID="guide-page" onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
          <View style={styles.toolbar}>
            <FocusButton
              label="◀ Earlier"
              variant="ghost"
              disabled={from - STEP_MS < nowSlot - MIN_BACK_MS}
              onPress={() => setFrom(from - STEP_MS)}
            />
            <FocusButton label="Now" variant="secondary" disabled={from === nowSlot} onPress={() => setFrom(nowSlot)} />
            <FocusButton
              label="Later ▶"
              variant="ghost"
              disabled={from + STEP_MS > nowSlot + MAX_AHEAD_MS}
              onPress={() => setFrom(from + STEP_MS)}
              testID="guide-later"
            />
            <Text style={styles.day}>
              {new Date(from).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>

          {guide.status === 'refreshing' ? <Text style={styles.banner}>Downloading the TV guide…</Text> : null}
          {guide.status === 'unavailable' ? (
            <Text style={styles.banner}>Your provider has no full TV guide. Showing what is available per channel.</Text>
          ) : null}
          {guide.error ? <ErrorText>{errorText(guide.error)}</ErrorText> : null}

          {described ? <ProgrammeDetails selection={described} now={now} onClose={() => setSelected(null)} /> : null}

          {guide.loading && guide.rows.length === 0 ? (
            <Loading />
          ) : pageWidth > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={pageWidth - CHANNEL_WIDTH < MIN_TIMELINE}>
              <View style={[styles.guide, { width: CHANNEL_WIDTH + timelineWidth }]} testID="guide">
                <TimeHeader from={from} to={to} width={timelineWidth} />
                {guide.rows.map((row, index) => (
                  <GuideRow
                    key={row.channel.id}
                    row={row}
                    from={from}
                    to={to}
                    now={now}
                    width={timelineWidth}
                    preferred={index === 0}
                    selected={selected}
                    onSelect={setSelected}
                  />
                ))}
                {nowAt != null ? (
                  <View pointerEvents="none" style={[styles.nowLine, { left: CHANNEL_WIDTH + nowAt * timelineWidth }]} />
                ) : null}
              </View>
            </ScrollView>
          ) : null}
          {moreChannels ? (
            <FocusButton
              label={`More channels (${guide.rows.length} of ${guide.totalChannels})`}
              variant="secondary"
              disabled={guide.loading}
              style={styles.more}
              onPress={() => setPages(pages + 1)}
            />
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function CategoryItem({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.category, active && styles.categoryActive, focused && styles.categoryFocused]}
    >
      <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{label}</Text>
    </Pressable>
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
  selected: Selection | null;
  onSelect(selection: Selection): void;
}

/** TV: Select plays (focus already selects). Phone: a tap selects, like a click on the web. */
const activate = (selection: Selection, onSelect: (selection: Selection) => void, playNow: () => void) =>
  Platform.isTV ? playNow() : onSelect(selection);

function GuideRow({ row, from, to, now, width, preferred, selected, onSelect }: GuideRowProps) {
  const { channel, programmes } = row;
  const cells = layoutGuideRow(programmes, from, to);
  return (
    <View style={styles.row}>
      <GuideCellButton
        style={styles.channel}
        testID={`guide-channel-${channel.id}`}
        label={`Watch ${channel.name}`}
        onPress={() => play(channel, programmeAt(programmes, now))}
        onFocus={() => Platform.isTV && onSelect({ channel, programme: programmeAt(programmes, now) })}
      >
        {channel.logoUrl ? (
          <Image source={{ uri: channel.logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logo} />
        )}
        <Text style={styles.channelName} numberOfLines={1}>
          {channel.number != null ? <Text style={styles.channelNumber}>{`${channel.number} `}</Text> : null}
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
              style={[
                styles.programme,
                { width: cellWidth - 2 },
                onNow && styles.programmeNow,
                past && styles.programmePast,
                selected?.programme === programme && styles.programmeSelected,
              ]}
              onPress={() => activate({ channel, programme }, onSelect, () => play(channel, onNow ? programme : null))}
              onFocus={() => Platform.isTV && onSelect({ channel, programme })}
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

function ProgrammeDetails({ selection, now, onClose }: { selection: Selection; now: number; onClose(): void }) {
  const { channel, programme } = selection;
  const onNow = programme ? Date.parse(programme.start) <= now && now < Date.parse(programme.end) : false;
  return (
    <View style={styles.details} testID="guide-info" accessibilityLabel="Programme details">
      <View style={styles.detailsText}>
        <Text style={styles.detailsTitle} numberOfLines={1}>
          {programme?.title ?? channel.name}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {channel.name}
          {programme ? ` · ${formatProgrammeTime(programme)}` : ''}
          {onNow ? ' · On now' : ''}
        </Text>
        {programme && onNow ? (
          <View style={styles.detailsBar}>
            <View style={[styles.detailsFill, { width: `${Math.round(programmeProgress(programme, now) * 100)}%` }]} />
          </View>
        ) : null}
        {programme?.description ? (
          <Text style={styles.detailsDescription} numberOfLines={Platform.isTV ? 2 : 4}>
            {programme.description}
          </Text>
        ) : null}
      </View>
      {Platform.isTV ? null : (
        <View style={styles.detailsActions}>
          <FocusButton
            label={onNow ? 'Watch live' : 'Watch channel'}
            variant="primary"
            onPress={() => play(channel, onNow ? programme : null)}
          />
          <FocusButton label="Close" variant="ghost" onPress={onClose} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
  live: { flexDirection: 'row', gap: 24 },
  categories: { width: CATEGORY_WIDTH, gap: 4 },
  category: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius, borderWidth: 2, borderColor: 'transparent' },
  categoryActive: { backgroundColor: colors.raised },
  categoryFocused: { borderColor: colors.strong },
  categoryText: { color: colors.text, fontSize: fonts.body },
  categoryTextActive: { color: colors.strong, fontWeight: '700' },
  page: { flex: 1, minWidth: 0 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  day: { color: colors.muted, fontSize: fonts.body, marginLeft: 'auto' },
  banner: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius,
    backgroundColor: colors.raised,
    color: colors.text,
    fontSize: 14.4,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    padding: 16,
    borderRadius: radius,
    backgroundColor: colors.surface,
  },
  detailsText: { flexGrow: 1, flexShrink: 1, flexBasis: 320 },
  detailsTitle: { color: colors.strong, fontSize: 20.8, fontWeight: '700', marginBottom: 4 },
  detailsBar: { height: 4, maxWidth: 320, marginVertical: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  detailsFill: { height: 4, backgroundColor: colors.accent },
  detailsDescription: { color: colors.text, fontSize: fonts.body, marginTop: 8 },
  detailsActions: { flexDirection: 'row', gap: 8 },
  muted: { color: colors.muted, fontSize: fonts.body },
  guide: { borderTopWidth: 1, borderTopColor: colors.border },
  timeHeader: { flexDirection: 'row', height: 32, borderBottomWidth: 1, borderBottomColor: colors.border },
  slot: {
    position: 'absolute',
    top: 6,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    color: colors.muted,
    fontSize: 12.8,
  },
  row: { flexDirection: 'row', height: ROW_HEIGHT, borderBottomWidth: 1, borderBottomColor: colors.border },
  channel: {
    width: CHANNEL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius,
  },
  logo: { width: 44, height: 44 },
  channelName: { flex: 1, color: colors.text, fontSize: fonts.body },
  channelNumber: { color: colors.muted },
  timeline: { flexDirection: 'row', paddingVertical: 4 },
  programme: {
    marginRight: 2,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius,
  },
  programmeNow: { backgroundColor: '#3a3a3a' },
  programmePast: { opacity: 0.55 },
  programmeSelected: { borderColor: colors.strong },
  programmeTitle: { color: colors.text, fontSize: fonts.body, fontWeight: '600' },
  programmeTime: { color: colors.muted, fontSize: fonts.tiny },
  gap: { justifyContent: 'center', paddingHorizontal: 10 },
  gapText: { color: colors.muted, fontSize: 12.8 },
  focused: { borderColor: colors.strong, backgroundColor: colors.raised },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.accent },
  more: { alignSelf: 'flex-start', marginTop: 16 },
});
