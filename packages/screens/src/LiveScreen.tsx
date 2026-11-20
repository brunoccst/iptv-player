import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
// Read through the namespace: React Native Web (desktop) has no TVFocusGuideView, and a named import of it fails there.
import * as ReactNative from 'react-native';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  catchupMode,
  catchupTarget,
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
import { useScreenHost, type ScreenHost } from './host';
import { CenteringScrollView, useCenterFocus, type Measurable } from './ui/CenterScroll';
import { ErrorText, errorText, Loading } from './ui/Feedback';
import { focus } from './ui/focus';
import { FocusButton } from './ui/FocusButton';
import { Gradient } from './ui/Gradient';
import { moveFocus, useFocusGrid } from './ui/focusGrid';
import { FocusRow } from './ui/FocusRow';
import { usePageFocusable } from './ui/pageFocus';
import { colors, fonts, radius, useCompact, useNavHeight, useSizes } from './ui/theme';

/** Same 3-hour window as the web guide (DECISIONS.md#d-088). */
const HOURS = 3;
const STEP_MS = 2 * EPG_SLOT_MS;
// A day back, for channels with recordings (issue #226).
const MIN_BACK_MS = 24 * 3600_000;
const MAX_AHEAD_MS = 46 * 3600_000;

interface Selection {
  channel: LiveChannel;
  programme: EpgListing | null;
}

/** Desktop: no remote, so nothing to listen to. */
const noRemote: NonNullable<ScreenHost['useRemote']> = () => {};

/**
 * TV Select on a programme: an ended one on a channel with recordings plays from the recording (issue #226), the one on
 * now plays live, others the channel.
 */
function playProgramme(host: ScreenHost, channel: LiveChannel, programme: EpgListing, now: number) {
  if (catchupMode(channel, programme, now) === 'past') playRecording(host, channel, programme);
  else play(host, channel, Date.parse(programme.start) <= now && now < Date.parse(programme.end) ? programme : null);
}

function play(host: ScreenHost, channel: LiveChannel, programme: EpgListing | null) {
  host.play(liveTarget(channel, programme?.title));
}

function playRecording(host: ScreenHost, channel: LiveChannel, programme: EpgListing) {
  host.play(catchupTarget(channel, programme));
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
      style={[
        styles.categoryItem,
        active && styles.categoryItemActive,
        focused && styles.categoryItemFocused,
      ]}
    >
      <View style={styles.categoryItemContent}>
        <View style={styles.categoryItemMain}>
          {isFavorites && <Text style={styles.favoritesIcon}>♥</Text>}
          <Text style={[styles.categoryItemLabel, active && styles.categoryItemLabelActive]}>{label}</Text>
        </View>
        <Text style={[styles.categoryItemCount, active && styles.categoryItemCountActive]}>
          {t('Total: {count}', { count })}
        </Text>
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
    ...categories.map((c) => ({ id: c.id as const, name: c.name, isFavorites: false })),
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
        const count = item.id === 'all'
          ? channelsByCategory.get('all')?.length ?? 0
          : item.id === 'favorites'
          ? channelsByCategory.get('favorites')?.length ?? 0
          : channelsByCategory.get(item.id)?.length ?? 0;
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
            focusRef={grid.ref(String(index))}
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

/** Video preview component - shows channel info with play button (platform-agnostic). */
interface VideoPreviewProps {
  channel: LiveChannel | null;
  programme: EpgListing | null;
  categoryName: string;
  onPlay?: () => void;
}

function VideoPreview({ channel, programme, categoryName, onPlay }: VideoPreviewProps) {
  const resolutionText = '1920 × 1080';

  return (
    <View style={styles.videoPreview} testID="video-preview">
      <View style={styles.videoPlaceholder}>
        {channel?.logoUrl && (
          <Image source={{ uri: channel.logoUrl }} style={styles.placeholderLogo} resizeMode="contain" />
        )}
        <Text style={styles.placeholderText}>{channel?.name ?? t('Select a channel')}</Text>
        {channel && onPlay && (
          <FocusButton
            label={t('Watch live')}
            variant="primary"
            style={styles.previewPlayButton}
            onPress={onPlay}
          />
        )}
      </View>
      <View style={styles.videoOverlay} pointerEvents="none">
        <View style={styles.overlayLeft}>
          <Text style={styles.overlayChannelName}>{channel?.name}</Text>
          <Text style={styles.overlayCategory}>{categoryName}</Text>
        </View>
        <View style={styles.overlayRight}>
          <Text style={styles.overlayMeta}>
            {channel?.number != null ? `N° ${channel.number}  •  ` : ''}{resolutionText}
          </Text>
        </View>
      </View>
    </View>
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
  const onNow = Date.parse(programme.start) <= now && now < Date.parse(programme.end);
  const past = Date.parse(programme.end) <= now;
  const reminders = host.hooks.useReminders();
  const reminded = reminders.has(channel.id, programme.start);

  return (
    <Pressable
      testID={`epg-programme-${programme.start}`}
      accessibilityRole={isCurrent ? 'button' : 'listitem'}
      accessibilityLabel={`${programme.title}, ${formatProgrammeTime(programme)}`}
      onPress={onPress}
      onFocus={onFocus}
      style={[
        styles.epgCard,
        isCurrent && styles.epgCardCurrent,
        isSelected && styles.epgCardSelected,
        past && styles.epgCardPast,
      ]}
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
            {formatGuideTime(Date.parse(programme.start))}
            {past ? ` • ${formatGuideTime(Date.parse(programme.end))}` : ''}
          </Text>
        </View>
      </View>
      {isCurrent && (
        <View style={styles.epgProgressContainer}>
          <View style={styles.epgProgressBar}>
            <View
              style={[
                styles.epgProgressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.epgProgressTimes}>
            <Text style={styles.epgProgressTime}>{formatGuideTime(Date.parse(programme.start))}</Text>
            <Text style={styles.epgProgressTime}>{formatGuideTime(Date.parse(programme.end))}</Text>
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
        programme={selectedProgramme}
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
  const [from, setFrom] = useState(() => floorToSlot(Date.now()));
  const [pages, setPages] = useState(1);
  const [selectedProgramme, setSelectedProgramme] = useState<EpgListing | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(null);
  const [channelList, setChannelList] = useState<LiveChannel[]>([]);
  const [channelsByCategory, setChannelsByCategory] = useState<Map<string, LiveChannel[]>>(new Map());
  const sizes = useSizes();
  const navH = useNavHeight();
  const { height: windowHeight } = useWindowDimensions();
  const to = from + HOURS * 3600_000;
  const nowSlot = floorToSlot(now);
  const compact = useCompact();
  const canEarlier = from - STEP_MS >= nowSlot - MIN_BACK_MS;
  const canLater = from + STEP_MS <= nowSlot + MAX_AHEAD_MS;

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
          setSelectedChannel(allChannels[0]);
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

  const chooseCategory = (id: string | null) => {
    host.setCategory(id);
    setPages(1);
    setSelectedProgramme(null);
    setSelectedChannel(null);
  };

  // Get category name for header
  const activeCategory = categories.find((c) => c.id === categoryId);
  const categoryName = categoryId === 'favorites' ? t('Favorites') : activeCategory?.name ?? t('All channels');

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
    <>
      {/* Top Header Bar */}
      <View style={styles.headerBar} testID="live-header">
        <View style={styles.headerLeft}>
          <Text style={styles.headerBrand}>IPTV Player</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.headerSection}>{t('Live TV')}</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.headerCategory}>{categoryName}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerPill}><Text style={styles.headerPillText}>{t('Current list: List 1')}</Text></View>
          <View style={[styles.headerPill, styles.headerPillActive]}><Text style={styles.headerPillTextActive}>{t('Activation FOREVER')}</Text></View>
        </View>
      </View>

      {/* Three-column Main Layout */}
      <View style={styles.mainLayout} testID="live-main">
        {/* Left Column - Categories */}
        <View style={styles.categoriesColumnWrapper}>
          <CategoryList
            categories={categories}
            categoryId={categoryId}
            onChoose={chooseCategory}
            navUp={host.useNavFocusTarget?.()}
            channelsByCategory={channelsByCategory}
          />
        </View>

        {/* Middle Column - Channel List */}
        <View style={styles.channelColumnWrapper}>
          {guide.loading && channelList.length === 0 ? (
            <View style={styles.loadingCenter}><Loading /></View>
          ) : (
            <ChannelList
              channels={channelList}
              selectedChannelId={selectedChannel?.id ?? null}
              onSelectChannel={setSelectedChannel}
              onPlayChannel={(ch) => play(host, ch, programmeAt(ch.programmes ?? [], now))}
              navUp={host.useNavFocusTarget?.()}
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
            onPlayChannel={(ch) => play(host, ch, programmeAt(ch.programmes ?? [], now))}
          />
        </View>
      </View>
    </>
  );

  const padding = { paddingTop: navH + 12, paddingHorizontal: sizes.gutter };
  const fit = Platform.OS === 'web' ? { height: windowHeight } : null;

  return compact ? (
    <ScrollView
      style={[styles.screen, fit]}
      testID="live-screen"
      contentContainerStyle={[padding, { paddingBottom: 60 }]}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={[styles.screen, fit, padding, { paddingBottom: 12 }]} testID="live-screen">
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceDark },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBrand: { color: colors.gold, fontSize: fonts.heading, fontWeight: '700' },
  headerSection: { color: colors.text, fontSize: fonts.body, fontWeight: '600' },
  headerCategory: { color: colors.muted, fontSize: fonts.small },
  headerDivider: { width: 1, height: 18, backgroundColor: colors.border },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerPillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  headerPillText: { color: colors.text, fontSize: fonts.tiny, fontWeight: '600' },
  headerPillTextActive: { color: colors.surfaceDark, fontSize: fonts.tiny, fontWeight: '600' },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 0,
  },
  categoriesColumnWrapper: {
    width: '22%',
    minWidth: 200,
    maxWidth: 260,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  categoriesColumn: {
    flex: 1,
    paddingVertical: 8,
  },
  categoryItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: radius,
  },
  categoryItemActive: { backgroundColor: colors.gold },
  categoryItemFocused: { backgroundColor: colors.goldHover },
  categoryItemContent: { flexDirection: 'column', gap: 2 },
  categoryItemMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  favoritesIcon: { color: colors.gold, fontSize: fonts.body },
  categoryItemLabel: { color: colors.text, fontSize: fonts.body, fontWeight: '500' },
  categoryItemLabelActive: { color: colors.surfaceDark, fontWeight: '700' },
  categoryItemCount: { color: colors.muted, fontSize: fonts.tiny },
  categoryItemCountActive: { color: colors.surfaceDark, opacity: 0.8 },

  channelColumnWrapper: {
    width: '30%',
    minWidth: 240,
    maxWidth: 320,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  channelColumn: { flex: 1 },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  channelItemActive: { backgroundColor: colors.gold },
  channelLogo: { width: 40, height: 40, borderRadius: 4 },
  channelLogoPlaceholder: { width: 40, height: 40, borderRadius: 4, backgroundColor: colors.raised },
  channelName: { flex: 1, color: colors.text, fontSize: fonts.body, fontWeight: '500' },
  channelNameActive: { color: colors.surfaceDark, fontWeight: '700' },
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
    backgroundColor: colors.surfaceCard,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  videoPreviewWrapper: {
    aspectRatio: 16 / 9,
    maxHeight: '50%',
  },
  videoPreview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderLogo: { width: 80, height: 80, opacity: 0.5 },
  placeholderText: { color: colors.muted, fontSize: fonts.body },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
  },
  errorText: { color: colors.warning, fontSize: fonts.small, textAlign: 'center' },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  overlayLeft: { flexDirection: 'column', gap: 2 },
  overlayRight: { alignItems: 'flex-end' },
  overlayChannelName: { color: colors.strong, fontSize: fonts.body, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  overlayCategory: { color: colors.muted, fontSize: fonts.tiny, textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  overlayMeta: { color: colors.text, fontSize: fonts.tiny, fontWeight: '500', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  epgSchedule: {
    flex: 1,
    minHeight: 0,
    padding: 8,
  },
  epgEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  epgEmptyText: { color: colors.muted, fontSize: fonts.body, textAlign: 'center' },
  epgCard: {
    backgroundColor: colors.raised,
    borderRadius: radius,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  epgCardCurrent: { backgroundColor: colors.gold, borderColor: colors.gold },
  epgCardSelected: { borderColor: colors.strong, borderWidth: 2 },
  epgCardPast: { opacity: 0.5 },
  epgCardHeader: { flexDirection: 'column', gap: 4 },
  epgCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  liveBadge: { color: colors.coral, fontSize: fonts.tiny },
  catchupBadge: { color: colors.warning, fontSize: fonts.tiny },
  reminderBadge: { fontSize: fonts.tiny },
  epgCardTitle: { flex: 1, color: colors.text, fontSize: fonts.body, fontWeight: '600' },
  epgCardTitleCurrent: { color: colors.surfaceDark },
  epgCardTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  epgCardTime: { color: colors.muted, fontSize: fonts.tiny },
  epgCardDescription: { color: colors.muted, fontSize: fonts.tiny, marginTop: 4, lineHeight: 18 },
  epgProgressContainer: { marginTop: 8, gap: 4 },
  epgProgressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  epgProgressFill: { height: '100%', backgroundColor: colors.coral, borderRadius: 2 },
  epgProgressTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  epgProgressTime: { color: colors.muted, fontSize: 10 },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

/** Memoized for performance with many channels. */
const ChannelListMemo = memo(ChannelList);
const VideoAndEpgMemo = memo(VideoAndEpg);
const CategoryItemMemo = memo(CategoryItem);
const EpgProgrammeCardMemo = memo(EpgProgrammeCard);

/** Categories that Channel +/− skip at once: a screenful, less one so the last one stays in sight. */
export function categoryPage(viewport: number, itemHeight: number): number {
  if (viewport <= 0 || itemHeight <= 0) return 5;
  return Math.max(1, Math.floor(viewport / itemHeight) - 1);
}