import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  EPG_SLOT_MS,
  floorToSlot,
  formatProgrammeTime,
  liveTarget,
  catchupMode,
  catchupTarget,
  programmeAt,
  programmeProgress,
  useEpgGuide,
  useNow,
  type EpgListing,
  type LiveChannel,
  type PlayTarget,
  t,
  formatGuideTimeWithDate,
} from '@iptv/shared';
import { useScreenHost, type ScreenHost } from './host';
import { CenteringScrollView, CenterFocus, useCenterFocus, useCenterPage, type Measurable } from './ui/CenterScroll';
import { Loading } from './ui/Feedback';
import { VideoPreview } from './VideoPreview';
import { moveFocus, useFocusGrid } from './ui/focusGrid';
import { RowFocus } from './ui/FocusRow';
import { colors, fonts, radius, useCompact, useNavHeight, useSizes, spacing } from './ui/theme';

/** Same 3-hour window as the web guide (DECISIONS.md#d-088). */
const HOURS = 3;
const STEP_MS = 2 * EPG_SLOT_MS;
// A day back, for channels with recordings (issue #226).
const MIN_BACK_MS = 24 * 3600_000;
const MAX_AHEAD_MS = 46 * 3600_000;

/** Desktop: no remote, so nothing to listen to. */
const noRemote: NonNullable<ScreenHost['useRemote']> = () => {};

function play(host: ScreenHost, target: PlayTarget) {
  host.play(target);
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
  previewPrimed: boolean;
  onPlayChannel(channel: LiveChannel): void;
  onPrimePreview(channel: LiveChannel): void;
  navUp?: View;
}

interface ChannelItemProps {
  channel: LiveChannel;
  index: number;
  active: boolean;
  previewPrimed: boolean;
  onPlayChannel(channel: LiveChannel): void;
  onPrimePreview(channel: LiveChannel): void;
  onFocus(index: number, channel: LiveChannel): void;
  onBlur(index: number, channelId: string): void;
  _navUp?: View;
  _last: number;
  focusRef: (view: View | null) => void;
  nextFocusUp?: View;
  nextFocusDown?: View;
}

const ChannelItem = memo(function ChannelItem({
  channel,
  index,
  active,
  previewPrimed,
  onPlayChannel,
  onPrimePreview,
  onFocus,
  onBlur,
  _navUp,
  _last,
  focusRef,
  nextFocusUp,
  nextFocusDown,
}: ChannelItemProps) {
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
      key={channel.id}
      ref={ref}
      testID={`live-channel-${index}`}
      accessibilityRole="button"
      accessibilityLabel={t('Watch {name}', { name: channel.name })}
      onPress={() => {
        if (active && previewPrimed) {
          onPlayChannel(channel);
        } else {
          onPrimePreview(channel);
        }
      }}
      onFocus={() => {
        setFocused(true);
        centerFocus?.(self.current as unknown as Measurable);
        onFocus(index, channel);
      }}
      onBlur={() => {
        setFocused(false);
        onBlur(index, channel.id);
      }}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      style={[styles.channelItem, active && styles.channelItemActive, focused && styles.channelItemFocused]}
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
});

/** TV channel lines: only lines near focus are mounted, like TvLines in TitleGrid. */
const CHANNEL_MOUNTED_AROUND = 8;
const CHANNEL_WINDOW_EDGE = 3;

function TvChannelLines({
  channels,
  selectedChannelId,
  previewPrimed,
  onPlayChannel,
  onPrimePreview,
  onFocus,
  onBlur,
  navUp,
  grid,
}: {
  channels: LiveChannel[];
  selectedChannelId: string | null;
  previewPrimed: boolean;
  onPlayChannel(channel: LiveChannel): void;
  onPrimePreview(channel: LiveChannel): void;
  onFocus(index: number, channel: LiveChannel): void;
  onBlur(index: number, channelId: string): void;
  navUp?: View;
  grid: ReturnType<typeof useFocusGrid>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TVFocusGuideView } = require('react-native');
  const [windowCenter, setWindowCenter] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [lineHeight, setLineHeight] = useState(0);
  const [onFirstLine, setOnFirstLine] = useState(true);
  const page = useCenterPage();
  const blockY = useRef(0);
  const count = channels.length;

  const latest = useRef({ page, lineHeight, windowCenter, count });
  latest.current = { page, lineHeight, windowCenter, count };

  const focusLine = useCallback((index: number) => {
    const now = latest.current;
    if (now.page && now.lineHeight) now.page.centerAt(blockY.current + index * now.lineHeight, now.lineHeight);
    setOnFirstLine(index === 0);
    if (Math.abs(index - now.windowCenter) > CHANNEL_MOUNTED_AROUND - CHANNEL_WINDOW_EDGE) {
      startTransition(() => setWindowCenter(index));
    }
  }, []);

  const measureFirst = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => setLineHeight((known) => known || event.nativeEvent.layout.height),
    [],
  );

  const renderLine = useCallback(
    (lineChannels: LiveChannel[], lineIndex: number) => (
      <View key={lineChannels[0]!.id} style={styles.channelLine}>
        {lineChannels.map((channel, colIndex) => {
          const index = lineIndex * 1 + colIndex; // single column, so index = lineIndex
          const active = selectedChannelId === channel.id;
          const focused = focusedIndex === index;
          return (
            <Pressable
              key={channel.id}
              testID={`live-channel-${index}`}
              accessibilityRole="button"
              accessibilityLabel={t('Watch {name}', { name: channel.name })}
              onPress={() => {
                if (active && previewPrimed) {
                  onPlayChannel(channel);
                } else {
                  onPrimePreview(channel);
                }
              }}
              onFocus={() => {
                setFocusedIndex(index);
                onFocus(index, channel);
              }}
              onBlur={() => {
                if (focusedIndex === index) setFocusedIndex(null);
                onBlur(index, channel.id);
              }}
              ref={grid.ref(String(index))}
              nextFocusUp={index === 0 ? navUp : grid.at(String(index - 1))}
              nextFocusDown={grid.at(String(Math.min(index + 1, count - 1)))}
              style={[styles.channelItem, active && styles.channelItemActive, focused && styles.channelItemFocused]}
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
      </View>
    ),
    [selectedChannelId, previewPrimed, onPlayChannel, onPrimePreview, onFocus, onBlur, navUp, grid, count, focusedIndex],
  );

  // Single column: each "line" is one channel
  const lines = useMemo(() => {
    const result: LiveChannel[][] = [];
    for (let i = 0; i < channels.length; i++) {
      result.push([channels[i]!]);
    }
    return result;
  }, [channels]);

  return (
    <TVFocusGuideView
      testID="live-channels-lines"
      trapFocusUp={Platform.isTV && !onFirstLine}
      onLayout={(event: { nativeEvent: { layout: { y: number } } }) => (blockY.current = event.nativeEvent.layout.y)}
    >
      <CenterFocus.Provider value={null}>
        {lines.map((line, index) => (
          <View
            key={line[0]!.id}
            testID={`live-channel-line-${index}`}
            style={lineHeight ? { height: lineHeight } : undefined}
            onLayout={index === 0 && !lineHeight ? measureFirst : undefined}
          >
            <RowFocus.Provider value={() => focusLine(index)}>
              {index === 0 || Math.abs(index - windowCenter) <= CHANNEL_MOUNTED_AROUND || !lineHeight ? (
                renderLine(line, index)
              ) : (
                <View testID={`live-channel-spacer-${index}`} style={{ height: lineHeight }} />
              )}
            </RowFocus.Provider>
          </View>
        ))}
      </CenterFocus.Provider>
    </TVFocusGuideView>
  );
}

function ChannelList({ channels, selectedChannelId, previewPrimed, onPlayChannel, onPrimePreview, navUp }: ChannelListProps) {
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

  const onFocus = useCallback(
    (index: number, channel: LiveChannel) => {
      focused.current = index;
      host.focusLiveChannel?.({
        id: channel.id,
        name: channel.name,
        logoUrl: channel.logoUrl,
        categoryId: channel.categoryId,
        number: channel.number,
      });
    },
    [host],
  );

  const onBlur = useCallback(
    (index: number, channelId: string) => {
      if (focused.current === index) {
        focused.current = null;
        host.blurLiveChannel?.(channelId);
      }
    },
    [host],
  );

  // TV: TvChannelLines virtualization
  if (Platform.isTV) {
    return (
      <ScrollView
        style={styles.channelColumn}
        testID="live-channels"
        accessibilityLabel={t('Channel list')}
        showsVerticalScrollIndicator={false}
      >
        <TvChannelLines
          channels={channels}
          selectedChannelId={selectedChannelId}
          previewPrimed={previewPrimed}
          onPlayChannel={onPlayChannel}
          onPrimePreview={onPrimePreview}
          onFocus={onFocus}
          onBlur={onBlur}
          navUp={navUp}
          grid={grid}
        />
      </ScrollView>
    );
  }

  // Phone/Desktop: FlatList virtualization
  return (
    <FlatList
      data={channels}
      keyExtractor={(channel) => channel.id}
      renderItem={({ item, index }) => (
        <ChannelItem
          channel={item}
          index={index}
          active={selectedChannelId === item.id}
          previewPrimed={previewPrimed}
          onPlayChannel={onPlayChannel}
          onPrimePreview={onPrimePreview}
          onFocus={onFocus}
          onBlur={onBlur}
          _navUp={navUp}
          _last={last}
          focusRef={grid.ref(String(index))}
          nextFocusUp={index === 0 ? navUp : grid.at(String(index - 1))}
          nextFocusDown={grid.at(String(Math.min(index + 1, last)))}
        />
      )}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={5}
      getItemLayout={(_, index) => ({ length: 56, offset: 56 * index, index })}
      removeClippedSubviews={false}
      scrollEventThrottle={100}
      style={styles.channelColumn}
      testID="live-channels"
      accessibilityLabel={t('Channel list')}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.loadingCenter}>
          <Loading />
        </View>
      }
    />
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
  const catchup = useMemo(() => catchupMode(channel, programme, now), [channel, programme, now]);
  const progress = useMemo(() => programmeProgress(programme, now), [programme, now]);
  const past = useMemo(() => Date.parse(programme.end) <= now, [programme.end, now]);
  const reminders = host.hooks.useReminders();
  const reminded = useMemo(() => reminders.has(channel.id, programme.start), [reminders, channel.id, programme.start]);

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
  _from,
  setFrom,
  canEarlier,
  canLater,
  previewPrimed,
  typedNumber,
}: {
  selectedChannel: LiveChannel | null;
  selectedProgramme: EpgListing | null;
  epgGuide: ReturnType<typeof useEpgGuide>;
  now: number;
  categoryName: string;
  onSelectProgramme(programme: EpgListing | null): void;
  onPlayChannel(target: LiveChannel | PlayTarget): void;
  _from: number;
  setFrom: (from: number | ((prev: number) => number)) => void;
  canEarlier: boolean;
  canLater: boolean;
  previewPrimed: boolean;
  typedNumber: string;
}) {
  const row = useMemo(() => epgGuide.rows.find((r) => r.channel.id === selectedChannel?.id), [epgGuide.rows, selectedChannel]);
  const programmes = useMemo(() => row?.programmes ?? [], [row]);
  const isCatchup = selectedProgramme && selectedChannel?.hasCatchup && catchupMode(selectedChannel, selectedProgramme, now) === 'past';

  // Find the currently airing programme index to auto-scroll to it
  const currentProgrammeIndex = useMemo(() => {
    return programmes.findIndex((p) => Date.parse(p.start) <= now && now < Date.parse(p.end));
  }, [programmes, now]);

  const flatListRef = useRef<FlatList<EpgListing> | null>(null);
  const flatListMounted = useRef(false);

  // Auto-scroll to current programme when programmes or channel changes
  useEffect(() => {
    if (currentProgrammeIndex >= 0 && flatListRef.current && flatListMounted.current) {
      flatListRef.current.scrollToIndex({ index: currentProgrammeIndex, animated: false });
    }
  }, [currentProgrammeIndex, programmes.length, selectedChannel]);

  // Track FlatList mount state
  const setFlatListRef = useCallback((ref: FlatList<EpgListing> | null) => {
    flatListRef.current = ref;
    flatListMounted.current = !!ref;
  }, []);

  const renderProgramme = useCallback(
    ({ item: programme }: { item: EpgListing }) => {
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
    },
    [now, selectedProgramme, selectedChannel, onPlayChannel, onSelectProgramme],
  );

  return (
    <View style={styles.videoEpgColumn} testID="video-epg-column">
      <VideoPreview
        channel={selectedChannel}
        _programme={selectedProgramme}
        categoryName={categoryName}
        onPlay={() => selectedChannel && onPlayChannel(selectedChannel)}
        catchupOnPlay={
          isCatchup
            ? () => {
                if (selectedChannel) onPlayChannel(catchupTarget(selectedChannel, selectedProgramme));
              }
            : undefined
        }
        primed={previewPrimed}
        typedNumber={typedNumber}
      />
      <View style={styles.epgHeader}>
        {canEarlier && (
          <Pressable
            testID="guide-earlier"
            accessibilityRole="button"
            accessibilityLabel={t('Earlier')}
            onPress={() => setFrom((prev: number) => prev - STEP_MS)}
            style={styles.guideNavButton}
          >
            <Text>{'◀ ' + t('Earlier')}</Text>
          </Pressable>
        )}
        {canLater && (
          <Pressable
            testID="guide-later"
            accessibilityRole="button"
            accessibilityLabel={t('Later')}
            onPress={() => setFrom((prev: number) => prev + STEP_MS)}
            style={styles.guideNavButton}
          >
            <Text>{t('Later') + ' ▶'}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.epgSchedule} testID="epg-schedule">
        {programmes.length === 0 ? (
          <View style={styles.epgEmpty}>
            <Text style={styles.epgEmptyText}>{t('No programme information for this channel')}</Text>
          </View>
        ) : (
          <FlatList
            ref={setFlatListRef}
            data={programmes}
            keyExtractor={(p) => p.start}
            renderItem={renderProgramme}
            getItemLayout={(_, index) => ({ length: 80, offset: 80 * index, index })}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={false}
            scrollEventThrottle={100}
            ListEmptyComponent={
              <View style={styles.epgEmpty}>
                <Text style={styles.epgEmptyText}>{t('No programme information for this channel')}</Text>
              </View>
            }
          />
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
  const favoriteChannels = host.hooks.useFavoriteChannels();
  const [from, setFrom] = useState<number>(() => floorToSlot(Date.now()));
  const [pages, setPages] = useState(1);
  const [selectedProgramme, setSelectedProgramme] = useState<EpgListing | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(null);
  const channelSelectionInitialized = useRef(false);
  const [previewPrimed, setPreviewPrimed] = useState(false);
  const [channelList, setChannelList] = useState<LiveChannel[]>([]);
  const [channelsByCategory, setChannelsByCategory] = useState<Map<string, LiveChannel[]>>(new Map());
  const sizes = useSizes();
  const navH = useNavHeight();
  const { height: windowHeight } = useWindowDimensions();
  const _to = from + HOURS * 3600_000;
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
        // Auto-select first channel for EPG, but don't prime preview until user presses OK
        if (allChannels.length > 0 && !channelSelectionInitialized.current) {
          channelSelectionInitialized.current = true;
          setSelectedChannel(allChannels[0]!);
        }
      }
      // Also load all channels for category counts
      const allChannelsAll = await host.stores.catalog.getState().loadLiveChannels(null);
      if (allChannelsAll) {
        const map = new Map<string, LiveChannel[]>();
        map.set('all', allChannelsAll);
        // Group by category CLIENT-SIDE (no additional API calls)
        for (const cat of categories) {
          map.set(
            cat.id,
            allChannelsAll.filter((c) => c.categoryId === cat.id),
          );
        }
        // Favorites: filter all channels by the user's favorite channel IDs
        const favoriteIds = new Set(favoriteChannels.map((c) => c.id));
        map.set(
          'favorites',
          allChannelsAll.filter((c) => favoriteIds.has(c.id)),
        );
        setChannelsByCategory(map);
      }
    };
    loadChannels();
  }, [categoryId, categories, host, favoriteChannels]);

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
    channelSelectionInitialized.current = false;
    setPreviewPrimed(false);
  };

  // Get category name for video preview overlay
  const activeCategory = categories.find((c) => c.id === categoryId);
  const categoryName = categoryId === 'favorites' ? t('Favorites') : (activeCategory?.name ?? t('All channels'));

  // Channel number entry via remote number keys (0-9)
  const typedNumberRef = useRef<string>('');
  const numberTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typedNumber, setTypedNumber] = useState<string>('');

  const clearTypedNumber = useCallback(() => {
    typedNumberRef.current = '';
    if (numberTimeoutRef.current) {
      clearTimeout(numberTimeoutRef.current);
      numberTimeoutRef.current = null;
    }
    setTypedNumber('');
  }, []);

  const commitTypedNumber = useCallback(() => {
    const num = Number(typedNumberRef.current);
    if (Number.isNaN(num) || num <= 0) {
      clearTypedNumber();
      return;
    }
    const channel = channelList.find((c) => c.number === num);
    if (channel) {
      const row = guide.rows.find((r) => r.channel.id === channel.id);
      play(host, liveTarget(channel, programmeAt(row?.programmes ?? [], now)?.title));
      setPreviewPrimed(false);
    }
    clearTypedNumber();
  }, [channelList, guide.rows, now, host, clearTypedNumber]);

  // Handle remote navigation between columns + channel number entry
  const columnFocus = useRef<'categories' | 'channels' | 'epg'>('channels');
  useRemote(({ key, action }) => {
    if (!Platform.isTV || action !== 'down') return;

    // Channel number entry: 0-9 keys build a number, commit after 2s pause or on select
    if (/^[0-9]$/.test(key)) {
      typedNumberRef.current += key;
      setTypedNumber(typedNumberRef.current);
      if (numberTimeoutRef.current) clearTimeout(numberTimeoutRef.current);
      numberTimeoutRef.current = setTimeout(commitTypedNumber, 2000);
      return;
    }

    // Select (OK) commits the typed number immediately
    if (key === 'select' && typedNumberRef.current) {
      commitTypedNumber();
      return;
    }

    // Any other key cancels number entry
    if (typedNumberRef.current && key !== 'channelUp' && key !== 'channelDown') {
      clearTypedNumber();
    }

    if (key === 'left') {
      if (columnFocus.current === 'channels') columnFocus.current = 'categories';
      else if (columnFocus.current === 'epg') columnFocus.current = 'channels';
    } else if (key === 'right') {
      if (columnFocus.current === 'categories') columnFocus.current = 'channels';
      else if (columnFocus.current === 'channels') columnFocus.current = 'epg';
    }
    // Note: Actual focus movement would need focus refs for each column
  });

  // Cleanup timeout on unmount
  useEffect(
    () => () => {
      if (numberTimeoutRef.current) clearTimeout(numberTimeoutRef.current);
    },
    [],
  );

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
            previewPrimed={previewPrimed}
            onPlayChannel={(ch) => {
              const row = guide.rows.find((r) => r.channel.id === ch.id);
              play(host, liveTarget(ch, programmeAt(row?.programmes ?? [], now)?.title));
            }}
            onPrimePreview={(ch) => {
              setSelectedChannel(ch);
              setPreviewPrimed(true);
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
          onPlayChannel={(target) => {
            if ('kind' in target) {
              // target is PlayTarget
              play(host, target);
            } else {
              // target is LiveChannel
              const row = guide.rows.find((r) => r.channel.id === target.id);
              play(host, liveTarget(target, programmeAt(row?.programmes ?? [], now)?.title));
            }
          }}
          _from={from}
          setFrom={setFrom}
          canEarlier={canEarlier}
          canLater={canLater}
          previewPrimed={previewPrimed}
          typedNumber={typedNumber}
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
  categoryItemActive: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.accent },
  categoryItemFocused: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border },
  categoryItemContent: { flexDirection: 'column', gap: spacing.xs },
  categoryItemMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  favoritesIcon: { color: colors.gold, fontSize: fonts.body },
  categoryItemLabel: { color: colors.text, fontSize: fonts.body, fontWeight: '500' },
  categoryItemLabelActive: { color: colors.strong, fontWeight: '700' },
  categoryItemCount: { color: colors.muted, fontSize: fonts.tiny },
  categoryItemCountActive: { color: colors.strong, opacity: 0.9 },

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
  channelLine: { flexDirection: 'row' },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  channelItemActive: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border },
  channelItemFocused: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border },
  channelLogo: { width: 40, height: 40, borderRadius: 4 },
  channelLogoPlaceholder: { width: 40, height: 40, borderRadius: 4, backgroundColor: colors.raised },
  channelName: { flex: 1, color: colors.text, fontSize: fonts.body, fontWeight: '500' },
  channelNameActive: { color: colors.strong, fontWeight: '700' },
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
  epgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  guideNavButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
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
  epgCardCurrent: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.blue },
  epgCardSelected: { borderColor: colors.blue, borderWidth: 2 },
  epgCardPast: { opacity: 0.5 },
  epgCardHeader: { flexDirection: 'column', gap: spacing.xs },
  epgCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  liveBadge: { color: colors.blue, fontSize: fonts.tiny, fontWeight: '600' },
  catchupBadge: { color: colors.gold, fontSize: fonts.tiny, fontWeight: '600' },
  reminderBadge: { fontSize: fonts.tiny },
  epgCardTitle: { flex: 1, color: colors.text, fontSize: fonts.body, fontWeight: '600' },
  epgCardTitleCurrent: { color: colors.text },
  epgCardTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  epgCardTime: { color: colors.muted, fontSize: fonts.tiny },
  epgCardDescription: { color: colors.muted, fontSize: fonts.tiny, marginTop: spacing.xs, lineHeight: 16 },
  epgProgressContainer: { marginTop: spacing.xs, gap: spacing.xs },
  epgProgressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  epgProgressFill: { height: '100%', backgroundColor: colors.blue, borderRadius: 2 },
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
