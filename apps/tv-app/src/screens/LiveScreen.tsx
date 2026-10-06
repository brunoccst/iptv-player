import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
  type NativeScrollEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  EPG_SLOT_MS,
  floorToSlot,
  formatGuideTime,
  formatProgrammeTime,
  guideSlots,
  layoutGuideRow,
  liveTarget,
  nowFraction,
  programmeAt,
  programmeProgress,
  useEpgGuide,
  useNow,
  type EpgChannelRow,
  type EpgListing,
  type LiveChannel,
  t,
  intlLocale,
} from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { ChipBar } from '../components/ChipBar';
import { ErrorText, errorText, Loading } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { useNavFocusTarget } from '../components/TopNav';
import { useCatalog, useNav } from '../hooks';
import { colors, fonts, radius, useCompact, useSizes, useNavHeight } from '../theme';
import { focus } from '../components/focus';
import { FocusRow } from '../components/FocusRow';

/** Same 3-hour window as the web guide (DECISIONS.md#d-031). */
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
    target: liveTarget(channel, programme?.title),
  });
}

/**
 * Same layout as the web Live TV page: category list, Earlier/Now/Later, programme details, channel × time grid.
 * TV: focusing a programme shows its details and Select plays. Phone: a tap selects it (web), "Watch live" plays. See DECISIONS.md#d-032.
 */
export function LiveScreen() {
  const categories = useCatalog((s) => s.categories.live?.data ?? []);
  // Kept in navStore so it survives opening the player and pressing Back (null = All channels).
  const categoryId = useNav((s) => s.categoryId);
  const now = useNow();
  const [from, setFrom] = useState(() => floorToSlot(Date.now()));
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  // Height left for the guide (time header and channels) under the toolbar and the programme details.
  const [guideHeight, setGuideHeight] = useState(0);
  const guide = useEpgGuide(stores.epg, { categoryId, from, hours: HOURS }, pages);
  const sizes = useSizes();
  const navH = useNavHeight();
  const to = from + HOURS * 3600_000;
  const nowSlot = floorToSlot(now);
  // Web phones: category list becomes a sideways row; the channel column shows only the logo (64 px).
  const compact = useCompact();
  const channelWidth = compact ? 64 : CHANNEL_WIDTH;
  const timelineWidth = Math.max(MIN_TIMELINE, pageWidth - channelWidth);
  // TV: Up from Earlier/Now/Later goes to the nav, not to a category scrolled out of sight above them.
  const navUp = useNavFocusTarget();

  useEffect(() => {
    void stores.catalog.getState().loadCategories('live');
  }, []);

  const chooseCategory = (id: string | null) => {
    navStore.getState().setCategory(id);
    setPages(1);
    setSelected(null);
  };

  // TV: before anything is focused, describe what is on now on the first channel.
  const first = guide.rows[0];
  const described = selected ?? (Platform.isTV && first ? { channel: first.channel, programme: programmeAt(first.programmes, now) } : null);
  const nowAt = nowFraction(now, from, to);
  const moreChannels = guide.rows.length < guide.totalChannels;
  // Near the end of the channels (the page on phones, the guide elsewhere), the next ones load.
  const loadMoreNearEnd = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) => {
    if (moreChannels && !guide.loading && layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) setPages(pages + 1);
  };

  const rows = guide.rows.map((row, index) => (
    <GuideRow
      key={row.channel.id}
      row={row}
      from={from}
      to={to}
      now={now}
      width={timelineWidth}
      preferred={index === 0}
      compact={compact}
      // Only this row's selection: moving focus re-renders two rows, not the whole guide.
      selected={selected?.channel.id === row.channel.id ? selected : null}
      onSelect={setSelected}
    />
  ));
  const more = moreChannels ? (
    <FocusButton
      label={t('More channels ({count} of {totalChannels})', { count: guide.rows.length, totalChannels: guide.totalChannels })}
      variant="secondary"
      disabled={guide.loading}
      style={styles.more}
      onPress={() => setPages(pages + 1)}
    />
  ) : null;

  const content = (
    <>
      <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>{t('Live TV')}</Text>
      <View style={[styles.live, compact ? styles.liveCompact : styles.liveFill]} testID="live-body">
        {compact ? (
          // Phones (portrait): the same expandable chips as Movies/Series.
          <ChipBar
            label={t('Channel categories')}
            testID="live-chips"
            chips={[
              { key: 'all', label: t('All channels'), active: categoryId === null, onPress: () => chooseCategory(null) },
              ...categories.map((c) => ({ key: c.id, label: c.name, active: categoryId === c.id, onPress: () => chooseCategory(c.id) })),
            ]}
          />
        ) : (
          // The page fits the screen; the list and the guide each scroll on their own (D-103, D-140).
          <ScrollView style={styles.categories} accessibilityLabel={t('Channel categories')} testID="live-categories">
            <CategoryItem label={t('All channels')} active={categoryId === null} onPress={() => chooseCategory(null)} />
            {categories.map((c) => (
              <CategoryItem key={c.id} label={c.name} active={categoryId === c.id} onPress={() => chooseCategory(c.id)} />
            ))}
          </ScrollView>
        )}

        <View style={compact ? undefined : styles.page} testID="guide-page" onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
          <FocusRow leftOpen style={styles.toolbar}>
            <FocusButton
              label={`◀ ${t('Earlier')}`}
              variant="ghost"
              disabled={from - STEP_MS < nowSlot - MIN_BACK_MS}
              onPress={() => setFrom(from - STEP_MS)}
              nextFocusUp={navUp}
              testID="guide-earlier"
            />
            <FocusButton
              label={t('Now')}
              variant="secondary"
              disabled={from === nowSlot}
              onPress={() => setFrom(nowSlot)}
              nextFocusUp={navUp}
            />
            <FocusButton
              label={`${t('Later')} ▶`}
              variant="ghost"
              disabled={from + STEP_MS > nowSlot + MAX_AHEAD_MS}
              onPress={() => setFrom(from + STEP_MS)}
              testID="guide-later"
              nextFocusUp={navUp}
            />
            <Text style={styles.day}>
              {new Date(from).toLocaleDateString(intlLocale(), { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </FocusRow>

          {guide.status === 'refreshing' ? <Text style={styles.banner}>{t('Downloading the TV guide…')}</Text> : null}
          {guide.status === 'unavailable' ? (
            <Text style={styles.banner}>{t('Your provider has no full TV guide. Showing what is available per channel.')}</Text>
          ) : null}
          {guide.error ? <ErrorText>{errorText(guide.error)}</ErrorText> : null}

          {described ? <ProgrammeDetails selection={described} now={now} onClose={() => setSelected(null)} /> : null}

          {guide.loading && guide.rows.length === 0 ? (
            <Loading />
          ) : compact ? (
            pageWidth > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={pageWidth - channelWidth < MIN_TIMELINE}>
                <View style={[styles.guide, { width: channelWidth + timelineWidth }]} testID="guide">
                  <TimeHeader from={from} to={to} width={timelineWidth} channelWidth={channelWidth} />
                  {rows}
                  {nowAt != null ? (
                    <View pointerEvents="none" style={[styles.nowLine, { left: channelWidth + nowAt * timelineWidth }]} />
                  ) : null}
                </View>
              </ScrollView>
            ) : null
          ) : (
            // The rest of the screen; the time header stays put while the channels scroll under it.
            <View style={styles.guideArea} testID="guide-area" onLayout={(e) => setGuideHeight(e.nativeEvent.layout.height)}>
              {pageWidth > 0 && guideHeight > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={pageWidth - channelWidth < MIN_TIMELINE}>
                  <View style={[styles.guide, { width: channelWidth + timelineWidth, height: guideHeight }]} testID="guide">
                    <TimeHeader from={from} to={to} width={timelineWidth} channelWidth={channelWidth} />
                    {/* TV: Down at the last channel (or "More channels") stays in the guide; Android otherwise jumped
                        to the nearest category below, on the left. */}
                    <TVFocusGuideView trapFocusDown={Platform.isTV} style={styles.channels} testID="guide-trap">
                      <ScrollView
                        testID="guide-channels"
                        onScroll={(event) => loadMoreNearEnd(event.nativeEvent)}
                        scrollEventThrottle={200}
                      >
                        {rows}
                        {more}
                      </ScrollView>
                    </TVFocusGuideView>
                    {nowAt != null ? (
                      <View pointerEvents="none" style={[styles.nowLine, { left: channelWidth + nowAt * timelineWidth }]} />
                    ) : null}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          )}
          {compact ? more : null}
        </View>
      </View>
    </>
  );

  const padding = { paddingTop: navH + 24, paddingHorizontal: sizes.gutter };
  // Phones: the whole page scrolls. Elsewhere it fits the screen and only the category list and the guide scroll.
  return compact ? (
    <ScrollView
      style={styles.screen}
      testID="live-screen"
      contentContainerStyle={[padding, { paddingBottom: 60 }]}
      onScroll={(event) => loadMoreNearEnd(event.nativeEvent)}
      scrollEventThrottle={200}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={[styles.screen, padding, { paddingBottom: 24 }]} testID="live-screen">
      {content}
    </View>
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

function TimeHeader({ from, to, width, channelWidth }: { from: number; to: number; width: number; channelWidth: number }) {
  const slots = useMemo(() => guideSlots(from, to), [from, to]);
  return (
    <View style={styles.timeHeader}>
      <View style={{ width: channelWidth }} />
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
  compact: boolean;
  selected: Selection | null;
  onSelect(selection: Selection): void;
}

/** TV: Select plays (focus already selects). Phone: a tap selects, like a click on the web. */
const activate = (selection: Selection, onSelect: (selection: Selection) => void, playNow: () => void) =>
  Platform.isTV ? playNow() : onSelect(selection);

/** Memoized: loading more channels or moving focus renders only the rows that changed (hundreds of channels, D-048). */
const GuideRow = memo(function GuideRow({ row, from, to, now, width, preferred, compact, selected, onSelect }: GuideRowProps) {
  const { channel, programmes } = row;
  const cells = layoutGuideRow(programmes, from, to);
  return (
    <FocusRow leftOpen style={styles.row}>
      <GuideCellButton
        style={[styles.channel, compact && styles.channelCompact]}
        testID={`guide-channel-${channel.id}`}
        label={t('Watch {name}', { name: channel.name })}
        onPress={() => play(channel, programmeAt(programmes, now))}
        onFocus={() => Platform.isTV && onSelect({ channel, programme: programmeAt(programmes, now) })}
      >
        {channel.logoUrl ? (
          <Image source={{ uri: channel.logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logo} />
        )}
        {compact ? null : (
          <Text style={styles.channelName} numberOfLines={1}>
            {channel.number != null ? <Text style={styles.channelNumber}>{`${channel.number} `}</Text> : null}
            {channel.name}
          </Text>
        )}
      </GuideCellButton>
      <View style={[styles.timeline, { width }]}>
        {cells.map((cell) => {
          const cellWidth = cell.width * width;
          if (!cell.programme) {
            return (
              <View key={`gap-${cell.startMs}`} style={[styles.gap, { width: cellWidth }]}>
                {programmes.length === 0 ? (
                  <Text style={styles.gapText} numberOfLines={1}>
                    {t('No guide information')}
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
    </FocusRow>
  );
});

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
    <View style={styles.details} testID="guide-info" accessibilityLabel={t('Programme details')}>
      <View style={styles.detailsText}>
        <Text style={styles.detailsTitle} numberOfLines={1}>
          {programme?.title ?? channel.name}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {channel.name}
          {programme ? ` · ${formatProgrammeTime(programme)}` : ''}
          {onNow ? ` · ${t('On now')}` : ''}
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
            label={onNow ? t('Watch live') : t('Watch channel')}
            variant="primary"
            onPress={() => play(channel, onNow ? programme : null)}
          />
          <FocusButton label={t('Close')} variant="ghost" onPress={onClose} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
  live: { flexDirection: 'row', gap: 24 },
  liveFill: { flex: 1, minHeight: 0 },
  categories: { width: CATEGORY_WIDTH, flexGrow: 0 },
  liveCompact: { flexDirection: 'column', gap: 12 },
  category: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius, borderWidth: 2, borderColor: 'transparent' },
  categoryActive: { backgroundColor: colors.raised },
  categoryFocused: { borderColor: 'transparent', backgroundColor: focus.fill },
  categoryText: { color: colors.text, fontSize: fonts.body },
  categoryTextActive: { color: colors.strong, fontWeight: '700' },
  page: { flex: 1, minWidth: 0, minHeight: 0 },
  guideArea: { flex: 1, minHeight: 0 },
  channels: { flex: 1, minHeight: 0 },
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
  channelCompact: { width: 64, paddingRight: 8 },
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
  focused: { borderColor: focus.ring, backgroundColor: '#4a4a4a', ...focus.glow },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.accent },
  more: { alignSelf: 'flex-start', marginTop: 16 },
});
