import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  EPG_SLOT_MS,
  floorToSlot,
  formatProgrammeTime,
  liveTarget,
  catchupMode,
  programmeAt,
  programmeProgress,
  useEpgGuide,
  useNow,
  type EpgListing,
  type LiveChannel,
  t,
  formatGuideTimeWithDate,
} from '@iptv/shared';
import { useScreenHost, type ScreenHost } from './host';
import { CenteringScrollView, useCenterFocus, type Measurable } from './ui/CenterScroll';
import { Loading } from './ui/Feedback';
import { VideoPreview } from './VideoPreview';
import { moveFocus, useFocusGrid } from './ui/focusGrid';
import { colors, fonts, radius, useCompact, useNavHeight, useSizes, spacing } from './ui/theme';

/** Same 3-hour window as the web guide (DECISIONS.md#d-088). */
const HOURS = 3;
const STEP_MS = 2 * EPG_SLOT_MS;
// A day back, for channels with recordings (issue #226).
const MIN_BACK_MS = 24 * 3600_000;
const MAX_AHEAD_MS = 46 * 3600_000;

/** Desktop: no remote, so nothing to listen to. */
const noRemote: NonNullable<ScreenHost['useRemote']> = () => {};

function play(host: ScreenHost, channel: LiveChannel, programme: EpgListing | null) {
  host.play(liveTarget(channel, programme?.title));
}

/** Compact category item for the left sidebar. */
interface CategoryItemProps {
  testID?: string;
  label: string;
  count: number;
  active: boolean;
  onPress(): void;
  focusRef?: (view: View | null) => void;
  nextFocusUp?: View;
  nextFocusDown?: View;
  onFocus?(): void;
  onBlur?(): void;
  isFavorites?: boolean;
}

function CategoryItem({
  testID,
  label,
  count,
  active,
  onPress,
  focusRef,
  nextFocusUp,
  nextFocusDown,
  onFocus,
  onBlur,
  isFavorites,
}: CategoryItemProps) {
  const [focused, setFocused] = useState(false);
  const centerFocus = useCenterFocus();
  const self = useRef<View | null>(null);
  const ref = useCallback(
    (view: View | null) => {
      self.current = view;
      focusRef?.(view);
    },
    [focusRef],
  );
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="tab"
      aria-selected={active}
      accessibilityLabel={label}
      onPress={onPress}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => {
        setFocused(true);
        centerFocus?.(self.current as unknown as Measurable);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      style={[styles.categoryItem, active && styles.categoryItemActive, focused && styles.categoryItemFocused]}
    >
      <View style={styles.categoryItemContent}>
        <View style={styles.categoryItemMain}>
          {isFavorites && <Text style={styles.favoritesIcon}>♥</Text>}
          <Text style={[styles.categoryItemLabel, active && styles.categoryItemLabelActive]}>{label}</Text>
        </View>
        <Text style={[styles.categoryItemCount, active && styles.categoryItemCountActive]}>{t('Total: {count}', { count })}</Text>
      </View>
    </Pressable>
  );
}

/** Left sidebar: categories/groups with channel counts. */
function CategoryList({
  categories,
  categoryId,
  onChoose,
  navUp,
  channelsByCategory,
}: {
  categories: { id: string; name: string }[];
  categoryId: string | null;
  onChoose(id: string | null): void;
  navUp: View | undefined;
  channelsByCategory: Map<string, LiveChannel[]>;
}) {
  const host = useScreenHost();
  const useRemote = host.useRemote ?? noRemote;
  const grid = useFocusGrid();
  const focused = useRef<number | null>(null);
  // Add "All channels" and "Favorites" as virtual categories
  const items = [
    { id: 'all' as const, name: t('All channels'), isFavorites: false },
    { id: 'favorites' as const, name: t('Favorites'), isFavorites: true },
    ...categories.map((c) => ({ id: c.id, name: c.name, isFavorites: false })),
  ];
  const last = items.length - 1;

  useRemote(({ key, action }) => {
    if ((key !== 'channelUp' && key !== 'channelDown') || action === 'up' || focused.current === null) return;
    const page = Math.max(1, Math.floor(300 / 50) - 1); // Approximate page size
    const target = Math.max(0, Math.min(last, focused.current + (key === 'channelDown' ? page : -page)));
    moveFocus(grid.at(String(target)));
  });

  return (
    <CenteringScrollView
      onlyCentering
      style={styles.categoriesColumn}
      accessibilityLabel={t('Channel categories')}
      testID="live-categories"
    >
      {items.map((item, index) => {
        const count =
          item.id === 'all'
            ? (channelsByCategory.get('all')?.length ?? 0)
            : item.id === 'favorites'
              ? (channelsByCategory.get('favorites')?.length ?? 0)
              : (channelsByCategory.get(item.id)?.length ?? 0);
        const active = categoryId === (item.id === 'all' ? null : item.id === 'favorites' ? 'favorites' : item.id);
        return (
          <CategoryItem
            key={item.id}
            testID={`live-category-${index}`}
            label={item.name}
            count={count}
            active={active}
            isFavorites={item.isFavorites}
            onPress={() => onChoose(item.id === 'all' ? null : item.id === 'favorites' ? 'favorites' : item.id)}
            focusRef={grid.ref(String(index))}
            nextFocusUp={index === 0 ? navUp : grid.at(String(index - 1))}
            nextFocusDown={grid.at(String(Math.min(index + 1, last)))}
            onFocus={() => (focused.current = index)}
            onBlur={() => {
              if (focused.current === index) focused.current = null;
            }}
          />
        );
      })}
    </CenteringScrollView>
  );
}

/** Middle column: dense channel list with logo, name, channel number badge. */
interface ChannelListProps {
  channels: LiveChannel[];
  selectedChannelId: string | null;
  onSelectChannel(channel: LiveChannel): void;
  onPlayChannel(channel: LiveChannel): void;
  navUp?: View;
}

function ChannelList({ channels, selectedChannelId, onSelectChannel, onPlayChannel, navUp }: ChannelListProps) {
  const host = useScreenHost();
  const useRemote = host.useRemote ?? noRemote;
  const grid = useFocusGrid();
  const focused = useRef<number | null>(null);
  const last = channels.length - 1;

  useRemote(({ key, action }) => {
    if ((key !== 'channelUp' && key !== 'channelDown') || action === 'up' || focused.current === null) return;
    const page = Math.max(1, Math.floor(300 / 50) - 1);
    const target = Math.max(0, Math.min(last, focused.current + (key === 'channelDown' ? page : -page)));
    moveFocus(grid.at(String(target)));
  });

  return (
    <ScrollView
      style={styles.channelColumn}
      testID="live-channels"
      accessibilityLabel={t('Channel list')}
      showsVerticalScrollIndicator={false}
    >
      {channels.map((channel, index) => {
        const active = selectedChannelId === channel.id;
        return (
          <Pressable
            key={channel.id}
            testID={`live-channel-${index}`}
            accessibilityRole="button"
            accessibilityLabel={t('Watch {name}', { name: channel.name })}
            onPress={() => onPlayChannel(channel)}
            onFocus={() => {
              onSelectChannel(channel);
              focused.current = index;
            }}
            onBlur={() => {
              if (focused.current === index) focused.current = null;
            }}
            ref={grid.ref(String(index))}
            nextFocusUp={index === 0 ? navUp : grid.at(String(index - 1))}
            nextFocusDown={grid.at(String(Math.min(index + 1, last)))}
            style={[styles.channelItem, active && styles.channelItemActive]}
          >
            {channel.logoUrl ? (
              <Image source={{ uri: channel.logoUrl }} style={styles.channelLogo} resizeMode="contain" />
            ) : (
              <View style={styles.channelLogoPlaceholder} />
            )}
            <Text style={[styles.channelName, active && styles.channelNameActive]} numberOfLines={1}>
              {channel.name}
            </Text>
            {channel.number != null && (
              <View style={styles.channelNumberBadge}>
                <Text style={styles.channelNumberText}>{channel.number}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** EPG programme card for the vertical schedule list. */
interface EpgProgrammeCardProps {
  programme: EpgListing;
  channel: LiveChannel;
  now: number;
  isCurrent: boolean;
  isSelected: boolean;
  onPress(): void;
  onFocus(): void;
}

function EpgProgrammeCard({ programme, channel, now, isCurrent, isSelected, onPress, onFocus }: EpgProgrammeCardProps) {
  const host = useScreenHost();
  const catchup = catchupMode(channel, programme, now);
  const progress = programmeProgress(programme, now);
  const _onNow = Date.parse(programme.start) <= now && now < Date.parse(programme.end);
  const past = Date.parse(programme.end) <= now;
  const reminders = host.hooks.useReminders();
  const reminded = reminders.has(channel.id, programme.start);

  return (
    <Pressable
      testID={`epg-programme-${programme.start}`}
      accessibilityRole={isCurrent ? 'button' : undefined}
      accessibilityLabel={`${programme.title}, ${formatProgrammeTime(programme)}`}
      onPress={onPress}
      onFocus={onFocus}
      style={[styles.epgCard, isCurrent && styles.epgCardCurrent, isSelected && styles.epgCardSelected, past && styles.epgCardPast]}
    >
      <View style={styles.epgCardHeader}>
        <View style={styles.epgCardTitleRow}>
          {isCurrent && <Text style={styles.liveBadge}>{'●'}</Text>}
          {catchup === 'past' && <Text style={styles.catchupBadge}>↺</Text>}
          {reminded && <Text style={styles.reminderBadge}>🔔</Text>}
          <Text style={[styles.epgCardTitle, isCurrent && styles.epgCardTitleCurrent]} numberOfLines={1}>
            {programme.title}
          </Text>
        </View>
        <View style={styles.epgCardTimeRow}>
          <Text style={styles.epgCardTime}>
            {formatGuideTimeWithDate(Date.parse(programme.start))}
            {past ? ` – ${formatGuideTimeWithDate(Date.parse(programme.end))}` : ''}
          </Text>
        </View>
      </View>
      {isCurrent && (
        <View style={styles.epgProgressContainer}>
          <View style={styles.epgProgressBar}>
            <View style={[styles.epgProgressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.epgProgressTimes}>
            <Text style={styles.epgProgressTime} testID="epg-progress-start">
              {formatGuideTimeWithDate(Date.parse(programme.start))}
            </Text>
            <Text style={styles.epgProgressTime} testID="epg-progress-end">
              {formatGuideTimeWithDate(Date.parse(programme.end))}
            </Text>
          </View>
        </View>
      )}
      {!isCurrent && programme.description && (
        <Text style={styles.epgCardDescription} numberOfLines={2}>
          {programme.description}
        </Text>
      )}
    </Pressable>
  );
}

/** Right column: Video preview + EPG schedule list. */
function VideoAndEpg({
  selectedChannel,
  selectedProgramme,
  epgGuide,
  now,
  categoryName,
  onSelectProgramme,
  onPlayChannel,
}: {
  selectedChannel: LiveChannel | null;
  selectedProgramme: EpgListing | null;
  epgGuide: ReturnType<typeof useEpgGuide>;
  now: number;
  categoryName: string;
  onSelectProgramme(programme: EpgListing | null): void;
  onPlayChannel(channel: LiveChannel): void;
}) {
  const row = useMemo(() => epgGuide.rows.find((r) => r.channel.id === selectedChannel?.id), [epgGuide.rows, selectedChannel]);
  const programmes = row?.programmes ?? [];

  return (
    <View style={styles.videoEpgColumn} testID="video-epg-column">
      <VideoPreview
        channel={selectedChannel}
        _programme={selectedProgramme}
        categoryName={categoryName}
        onPlay={() => selectedChannel && onPlayChannel(selectedChannel)}
      />
      <View style={styles.epgSchedule} testID="epg-schedule">
        {programmes.length === 0 ? (
          <View style={styles.epgEmpty}>
            <Text style={styles.epgEmptyText}>{t('No programme information for this channel')}</Text>
          </View>
        ) : (
          programmes.map((programme) => {
            const isCurrent = Date.parse(programme.start) <= now && now < Date.parse(programme.end);
            const isSelected = selectedProgramme?.start === programme.start;
            return (
              <EpgProgrammeCard
                key={programme.start}
                programme={programme}
                channel={selectedChannel!}
                now={now}
                isCurrent={isCurrent}
                isSelected={isSelected}
                onPress={() => {
                  if (isCurrent) onPlayChannel(selectedChannel!);
                  else onSelectProgramme(programme);
                }}
                onFocus={() => onSelectProgramme(programme)}
              />
            );
          })
        )}
      </View>
    </View>
  );
}

/**
 * Three-column Live TV guide:
 * Left: Categories sidebar
 * Middle: Channel list
 * Right: Video preview + EPG schedule
 */
export function LiveScreen() {
  const host = useScreenHost();
  const useRemote = host.useRemote ?? noRemote;
  const categories = host.hooks.useCatalog((s) => s.categories.live?.data ?? []);
  const categoryId = host.useCategory();
  const now = useNow();
  const [from, _setFrom] = useState(() => floorToSlot(Date.now()));
  const [pages, setPages] = useState(1);
  const [selectedProgramme, setSelectedProgramme] = useState<EpgListing | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(null);
  const [channelList, setChannelList] = useState<LiveChannel[]>([]);
  const [channelsByCategory, setChannelsByCategory] = useState<Map<string, LiveChannel[]>>(new Map());
  const sizes = useSizes();
  const navH = useNavHeight();
  const { height: windowHeight } = useWindowDimensions();
  const _to = from + HOURS * 3600_000;
  const nowSlot = floorToSlot(now);
  const compact = useCompact();
  const _canEarlier = from - STEP_MS >= nowSlot - MIN_BACK_MS;
  const _canLater = from + STEP_MS <= nowSlot + MAX_AHEAD_MS;

  // Load EPG guide for selected category
  const guide = useEpgGuide(host.stores.epg, { categoryId, from, hours: HOURS }, pages);

  // Load channels for the selected category (for middle column)
  useEffect(() => {
    const loadChannels = async () => {
      const allChannels = await host.stores.catalog.getState().loadLiveChannels(categoryId);
      if (allChannels) {
        setChannelList(allChannels);
        // Auto-select first channel if none selected
        if (!selectedChannel && allChannels.length > 0) {
          setSelectedChannel(allChannels[0]!);
        }
      }
      // Also load all channels for category counts
      const allChannelsAll = await host.stores.catalog.getState().loadLiveChannels(null);
      if (allChannelsAll) {
        const map = new Map<string, LiveChannel[]>();
        map.set('all', allChannelsAll);
        // Group by category
        for (const cat of categories) {
          const catChannels = await host.stores.catalog.getState().loadLiveChannels(cat.id);
          if (catChannels) map.set(cat.id, catChannels);
        }
        // Favorites - would come from profile prefs in real implementation
        map.set('favorites', allChannelsAll.slice(0, 10));
        setChannelsByCategory(map);
      }
    };
    loadChannels();
  }, [categoryId, categories, host, selectedChannel]);

  useEffect(() => {
    void host.stores.catalog.getState().loadCategories('live');
  }, [host]);

  // Call useNavFocusTarget unconditionally to avoid "Rendered more hooks" error
  const navFocusTarget = host.useNavFocusTarget?.();

  const chooseCategory = (id: string | null) => {
    host.setCategory(id);
    setPages(1);
    setSelectedProgramme(null);
    setSelectedChannel(null);
  };

  // Get category name for video preview overlay
  const activeCategory = categories.find((c) => c.id === categoryId);
  const categoryName = categoryId === 'favorites' ? t('Favorites') : (activeCategory?.name ?? t('All channels'));

  // Handle remote navigation between columns
  const columnFocus = useRef<'categories' | 'channels' | 'epg'>('channels');
  useRemote(({ key, action }) => {
    if (!Platform.isTV || action !== 'down') return;
    if (key === 'left') {
      if (columnFocus.current === 'channels') columnFocus.current = 'categories';
      else if (columnFocus.current === 'epg') columnFocus.current = 'channels';
    } else if (key === 'right') {
      if (columnFocus.current === 'categories') columnFocus.current = 'channels';
      else if (columnFocus.current === 'channels') columnFocus.current = 'epg';
    }
    // Note: Actual focus movement would need focus refs for each column
  });

  const content = (
    <View style={styles.mainLayout} testID="live-main">
      {/* Left Column - Categories */}
      <View style={styles.categoriesColumnWrapper}>
        <CategoryList
          categories={categories}
          categoryId={categoryId}
          onChoose={chooseCategory}
          navUp={navFocusTarget}
          channelsByCategory={channelsByCategory}
        />
      </View>

      {/* Middle Column - Channel List */}
      <View style={styles.channelColumnWrapper}>
        {guide.loading && channelList.length === 0 ? (
          <View style={styles.loadingCenter}>
            <Loading />
          </View>
        ) : (
          <ChannelList
            channels={channelList}
            selectedChannelId={selectedChannel?.id ?? null}
            onSelectChannel={setSelectedChannel}
            onPlayChannel={(ch) => {
              const row = guide.rows.find((r) => r.channel.id === ch.id);
              play(host, ch, programmeAt(row?.programmes ?? [], now));
            }}
            navUp={navFocusTarget}
          />
        )}
      </View>

      {/* Right Column - Video Preview + EPG */}
      <View style={styles.videoEpgColumnWrapper}>
        <VideoAndEpg
          selectedChannel={selectedChannel}
          selectedProgramme={selectedProgramme}
          epgGuide={guide}
          now={now}
          categoryName={categoryName}
          onSelectProgramme={setSelectedProgramme}
          onPlayChannel={(ch) => {
            const row = guide.rows.find((r) => r.channel.id === ch.id);
            play(host, ch, programmeAt(row?.programmes ?? [], now));
          }}
        />
      </View>
    </View>
  );

  const padding = { paddingTop: navH + spacing.md, paddingHorizontal: sizes.gutter };
  const fit = Platform.OS === 'web' ? { height: windowHeight } : null;

  return compact ? (
    <ScrollView style={[styles.screen, fit]} testID="live-screen" contentContainerStyle={[padding, { paddingBottom: 60 }]}>
      {content}
    </ScrollView>
  ) : (
    <View style={[styles.screen, fit, padding, { paddingBottom: spacing.md }]} testID="live-screen">
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 0,
  },
  categoriesColumnWrapper: {
    width: '22%',
    minWidth: 200,
    maxWidth: 260,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  categoriesColumn: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  categoryItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: radius,
  },
  categoryItemActive: { backgroundColor: colors.accent },
  categoryItemFocused: { backgroundColor: colors.accentHover },
  categoryItemContent: { flexDirection: 'column', gap: spacing.xs },
  categoryItemMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  favoritesIcon: { color: colors.accent, fontSize: fonts.body },
  categoryItemLabel: { color: colors.text, fontSize: fonts.body, fontWeight: '500' },
  categoryItemLabelActive: { color: colors.bg, fontWeight: '700' },
  categoryItemCount: { color: colors.muted, fontSize: fonts.tiny },
  categoryItemCountActive: { color: colors.bg, opacity: 0.8 },

  channelColumnWrapper: {
    width: '30%',
    minWidth: 240,
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  channelColumn: { flex: 1 },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  channelItemActive: { backgroundColor: colors.accent },
  channelLogo: { width: 40, height: 40, borderRadius: 4 },
  channelLogoPlaceholder: { width: 40, height: 40, borderRadius: 4, backgroundColor: colors.raised },
  channelName: { flex: 1, color: colors.text, fontSize: fonts.body, fontWeight: '500' },
  channelNameActive: { color: colors.bg, fontWeight: '700' },
  channelNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius,
    backgroundColor: colors.blue,
  },
  channelNumberText: { color: '#fff', fontSize: fonts.tiny, fontWeight: '700' },

  videoEpgColumnWrapper: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  videoEpgColumn: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  epgSchedule: {
    flex: 1,
    minHeight: 0,
    padding: spacing.sm,
  },
  epgEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  epgEmptyText: { color: colors.muted, fontSize: fonts.body, textAlign: 'center' },
  epgCard: {
    backgroundColor: colors.raised,
    borderRadius: radius,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  epgCardCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  epgCardSelected: { borderColor: colors.strong, borderWidth: 2 },
  epgCardPast: { opacity: 0.5 },
  epgCardHeader: { flexDirection: 'column', gap: spacing.xs },
  epgCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  liveBadge: { color: colors.warning, fontSize: fonts.tiny },
  catchupBadge: { color: colors.warning, fontSize: fonts.tiny },
  reminderBadge: { fontSize: fonts.tiny },
  epgCardTitle: { flex: 1, color: colors.text, fontSize: fonts.body, fontWeight: '600' },
  epgCardTitleCurrent: { color: colors.bg },
  epgCardTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  epgCardTime: { color: colors.muted, fontSize: fonts.tiny },
  epgCardDescription: { color: colors.muted, fontSize: fonts.tiny, marginTop: spacing.xs, lineHeight: 16 },
  epgProgressContainer: { marginTop: spacing.xs, gap: spacing.xs },
  epgProgressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  epgProgressFill: { height: '100%', backgroundColor: colors.warning, borderRadius: 2 },
  epgProgressTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  epgProgressTime: { color: colors.muted, fontSize: 9 },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

/** Memoized for performance with many channels. */
const _ChannelListMemo = memo(ChannelList);
const _VideoAndEpgMemo = memo(VideoAndEpg);
const _CategoryItemMemo = memo(CategoryItem);
const _EpgProgrammeCardMemo = memo(EpgProgrammeCard);

/** Categories that Channel +/− skip at once: a screenful, less one so the last one stays in sight. */
export function categoryPage(viewport: number, itemHeight: number): number {
  if (viewport <= 0 || itemHeight <= 0) return 5;
  return Math.max(1, Math.floor(viewport / itemHeight) - 1);
}
