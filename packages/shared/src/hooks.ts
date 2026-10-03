import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from './api/errors';
import type {
  CatalogSection,
  LibrarySection,
  LiveChannel,
  MasterCard,
  MasterDetails,
  MediaCategory,
  ProfileDto,
  ProgressDto,
  ProgrammeMatch,
  VariantInfo,
} from './api/types';
import type { AppContext } from './appContext';
import { offlineAccess } from './playback/offlineAccess';
import { AVATAR_COLORS, avatarColor } from './design/avatar';
import { needsPinToManage, needsPinToOpen } from './stores/pinStore';
import { t, tn } from './i18n/i18n';
import { MAX_SEARCH_CHANNELS, MAX_SEARCH_PROGRAMMES } from './search/useSearchQuery';
import { addRecentChannel, MAX_RECENT_CHANNELS, recentChannelOf, type RecentChannel } from './playback/recentChannels';
import { isKidsCategory } from './profiles/kidsFilter';
import { profileLanguages } from './stores/profilePrefsStore';
import { selectActiveProfile } from './stores/sessionStore';
import { chooseVersion } from './playback/playbackChoices';
import { loadSeriesVersions, mergeSeriesVersions, playerSeriesVersions, seriesVersionsOf } from './playback/seriesVersions';
import { nextEpisode, previousEpisode } from './playback/rules';
import { episodeTarget, movieTarget, progressTarget, type PlayTarget } from './playback/targets';
import {
  allEpisodesWatched,
  cardMenuItems,
  continueWatchlistEntry,
  isMovieWatched,
  markEntryWatched,
  removeFromContinueWatching,
  isSeriesWatched,
  noteSeriesWatched,
  setMovieWatched,
  setSeriesWatched,
} from './playback/watched';
import { useAppStore } from './react';
import type { CatalogState } from './stores/catalogStore';
import { pageKey, selectVariant, type LibrarySortChoice, type LibraryState } from './stores/libraryStore';
import type { PinState } from './stores/pinStore';
import type { ProfilePrefsState } from './stores/profilePrefsStore';
import type { ProgressState } from './stores/progressStore';
import type { SessionState } from './stores/sessionStore';
import { isOnWatchlist, type WatchlistState } from './stores/watchlistStore';

/**
 * Hooks the TV/phone app and the desktop/web app share (D-124): the same state, loading and paging for both; each app
 * only draws. Made once per app from its stores: `export const { useSession, usePagedLibrary } = createAppHooks(stores)`.
 */
/** The sections a profile's category settings cover, in their order on screen. */
export const CATEGORY_SECTIONS: { section: CatalogSection; label: () => string }[] = [
  { section: 'movies', label: () => t('Movies') },
  { section: 'series', label: () => t('Series') },
  { section: 'live', label: () => t('Live TV') },
];

/**
 * The details panel's round "Watched" toggle (D-104): an open eye when watched, a closed one when not. For a series it
 * marks every episode. Presses while a change is still being saved are ignored.
 */
export function useWatchedToggle(kind: 'movie' | 'series', watched: boolean, onChange: (watched: boolean) => Promise<void>) {
  const busy = useRef(false);
  const label =
    kind === 'series'
      ? watched
        ? t('Mark series as not watched')
        : t('Mark series as watched')
      : watched
        ? t('Mark as not watched')
        : t('Mark as watched');
  return {
    icon: watched ? ('eye' as const) : ('eyeOff' as const),
    label,
    toggle: () => {
      if (busy.current) return;
      busy.current = true;
      void onChange(!watched).finally(() => (busy.current = false));
    },
  };
}

const NO_VARIANTS: VariantInfo[] = [];

/** Saves where playback of a movie or episode is (live channels have none). */
export function savePlaybackProgress(
  progress: Pick<AppContext['stores'], 'progress'>['progress'],
  target: PlayTarget,
  positionSeconds: number,
  durationSeconds: number,
): void {
  if (target.kind === 'live' || !(durationSeconds > 0)) return;
  void progress.getState().save(target.kind, target.streamId, {
    title: target.title,
    positionSeconds,
    durationSeconds,
    masterId: target.masterId ?? null,
    seriesId: target.seriesId ?? null,
    seasonNumber: target.seasonNumber ?? null,
    episodeNumber: target.episodeNumber ?? null,
    posterUrl: target.posterUrl ?? null,
    containerExtension: target.container,
  });
}

export function createAppHooks({
  api,
  stores,
  reloadLists,
}: Pick<AppContext, 'api' | 'stores'> & {
  /** Every row and grid loads again (after a profile setting that changes what lists show). */
  reloadLists: () => void;
}) {
  const useSession = <T>(selector: (state: SessionState) => T) => useAppStore(stores.session, selector);
  const useLibrary = <T>(selector: (state: LibraryState) => T) => useAppStore(stores.library, selector);
  const useProgress = <T>(selector: (state: ProgressState) => T) => useAppStore(stores.progress, selector);

  /** One section's categories at a time, each read once while the panel is open. */
  const useSectionCategories = (includeHidden: boolean) => {
    const [section, setSection] = useState<CatalogSection>('movies');
    const [lists, setLists] = useState<Partial<Record<CatalogSection, MediaCategory[]>>>({});
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
      if (lists[section]) return;
      api.catalog
        .categories(section, undefined, includeHidden ? { includeHidden: true } : undefined)
        .then((list) => setLists((current) => ({ ...current, [section]: list })))
        .catch(() => setError(t('The categories could not be loaded.')));
    }, [section, lists]); // eslint-disable-line react-hooks/exhaustive-deps
    return { section, setSection, categories: lists[section] ?? null, error };
  };

  /** Latest progress for any version of this title (or series), for "Resume". */
  const useMasterProgress = (master: MasterDetails, kind: 'movie' | 'episode'): ProgressDto | null =>
    useProgress(
      (s) =>
        (s.items.data ?? []).find(
          (p) =>
            p.kind === kind &&
            (p.masterId === master.id || master.variants.some((v) => v.streamId === (kind === 'movie' ? p.itemId : p.seriesId))),
        ) ?? null,
    );

  /** The active profile's recently watched channels, newest first (issue #122, D-129). */
  const useRecentChannels = (limit = MAX_RECENT_CHANNELS): RecentChannel[] => {
    const profileId = useSession((s) => s.activeProfileId);
    const list = useAppStore(stores.profilePrefs, (s) => (profileId ? s.prefs[profileId]?.recentChannels : null));
    return useMemo(() => (list ?? []).slice(0, limit), [list, limit]);
  };

  return {
    useSession,
    useCatalog: <T>(selector: (state: CatalogState) => T) => useAppStore(stores.catalog, selector),
    useLibrary,
    useProgress,
    useWatchlist: <T>(selector: (state: WatchlistState) => T) => useAppStore(stores.watchlist, selector),
    useProfilePrefs: <T>(selector: (state: ProfilePrefsState) => T) => useAppStore(stores.profilePrefs, selector),
    usePin: <T>(selector: (state: PinState) => T) => useAppStore(stores.pin, selector),

    /**
     * "Who's watching?" (D-054): a profile opens, or in manage mode opens the editor. Managing asks for the PIN once
     * until the picker closes; a profile the PIN protects asks for it.
     */
    useProfilePicker(gate: PinGate) {
      const profiles = useSession((s) => s.profiles);
      const pinStatus = useAppStore(stores.pin, (s) => s.status);
      const [managing, setManaging] = useState(false);
      const [editing, setEditing] = useState<ProfileDto | 'new' | null>(null);
      const [unlocked, setUnlocked] = useState(false);
      const manage = (action: () => void) =>
        gate(needsPinToManage(pinStatus) && !unlocked, t('Enter the parental PIN to manage profiles'), () => {
          setUnlocked(true);
          action();
        });
      return {
        profiles,
        managing,
        /** The profile being edited, 'new' for a new one, or null. */
        editing,
        canAdd: profiles.length < MAX_PROFILES,
        select: (profile: ProfileDto) =>
          managing
            ? setEditing(profile)
            : gate(needsPinToOpen(pinStatus, null, profile), t('Enter the parental PIN to open {name}', { name: profile.name }), () =>
                stores.session.getState().selectProfile(profile.id),
              ),
        add: () => manage(() => setEditing('new')),
        toggleManaging: () => (managing ? setManaging(false) : manage(() => setManaging(true))),
        closeEditor: () => setEditing(null),
      };
    },

    /** A profile's name, colour and Kids flag; Save or Delete. `profile` null: a new one. */
    useProfileEditor(profile: ProfileDto | null, onClose: () => void) {
      const busy = useSession((s) => s.busy);
      const error = useSession((s) => s.error);
      const [name, setName] = useState(profile?.name ?? '');
      const [isKids, setIsKids] = useState(profile?.isKids ?? false);
      const [color, setColor] = useState(profile ? avatarColor(profile) : AVATAR_COLORS[0]!);
      const session = () => stores.session.getState();
      return {
        busy,
        error,
        name,
        setName,
        isKids,
        setIsKids,
        color,
        setColor,
        colors: AVATAR_COLORS,
        async save() {
          const request = { name: name.trim(), isKids, avatarKey: color };
          const saved = profile ? await session().updateProfile(profile.id, request) : await session().createProfile(request);
          if (saved) onClose();
        },
        async remove() {
          if (profile && (await session().deleteProfile(profile.id))) onClose();
        },
        /** Closes without saving (and forgets the last error). */
        close() {
          session().clearError();
          onClose();
        },
      };
    },

    /**
     * A movie's details page: the chosen version, its provider info, resume and watched. `play` is what to play (with the
     * resume point when it is this version); null without a playable version.
     */
    useMovieDetails(master: MasterDetails) {
      const variant = useLibrary((s) => selectVariant(s, master));
      const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
      const resume = useMasterProgress(master, 'movie');
      const watched = useProgress((s) => isMovieWatched(s.items.data ?? [], master.id));
      useEffect(() => {
        // Resuming a different version than the best one: preselect it so "Resume" continues where the user left off.
        if (resume && master.variants.some((v) => v.streamId === resume.itemId))
          stores.library.getState().selectVariant(master.id, resume.itemId);
      }, [resume?.itemId, master]); // eslint-disable-line react-hooks/exhaustive-deps
      const canResume = !!variant && resume?.itemId === variant.streamId;
      const target = variant ? movieTarget(master, variant) : null;
      return {
        variant,
        meta,
        watched,
        canResume,
        /** The version without a resume point (downloads, other players). */
        target,
        play: target ? { ...target, startAt: canResume ? resume!.positionSeconds : undefined } : null,
        backdrop: meta.data?.backdropUrls[0] ?? meta.data?.summary.posterUrl ?? master.posterUrl,
        duration: meta.data?.durationSeconds ?? null,
        rating: meta.data?.summary.rating ?? master.rating,
        choose: (streamId: string) => {
          const picked = master.variants.find((v) => v.streamId === streamId);
          if (picked) chooseVersion(stores, master.id, picked);
        },
        setWatched: (next: boolean) => setMovieWatched(stores, master.id, next),
      };
    },

    /**
     * A series' details page: all versions' episode lists merged into one (D-066), resume, and whether every episode was
     * watched (noted for the cover's tag, D-082). `play` resumes, or starts the first episode.
     */
    useSeriesDetails(master: MasterDetails) {
      const variant = useLibrary((s) => selectVariant(s, master));
      const versions = useAsync(variant ? `series-versions:${master.variants.map((v) => v.streamId).join(',')}` : null, () =>
        loadSeriesVersions(api, seriesVersionsOf(master)),
      );
      const merged = useMemo(
        () => (versions.data ? mergeSeriesVersions(versions.data, variant?.streamId) : null),
        [versions.data, variant],
      );
      const resume = useMasterProgress(master, 'episode');
      // Only once the progress list has loaded, so a slow start never clears the note.
      const progressLoaded = useProgress((s) => s.items.status === 'success');
      const allWatched = useProgress((s) => !!merged && allEpisodesWatched(s, merged));
      useEffect(() => {
        if (merged && progressLoaded)
          void noteSeriesWatched(stores.profilePrefs, stores.progress.getState().profileId, master.id, allWatched);
      }, [merged, progressLoaded, allWatched, master.id]);
      const first = merged?.seasons[0]?.episodes[0];
      return {
        variant,
        series: { ...versions, data: merged },
        resume,
        allWatched,
        backdrop: merged?.backdropUrls[0] ?? master.posterUrl,
        play: resume
          ? progressTarget(resume)
          : first
            ? episodeTarget({ title: master.title, masterId: master.id, seriesId: first.seriesId, posterUrl: master.posterUrl }, first)
            : null,
      };
    },

    /**
     * Profile editor → Choose categories (D-064): what a Kids profile may see, per section. Starts from the automatic
     * choice (category names, D-053); `automatic()` goes back to it.
     */
    useKidsCategories(profileId: string, onClose: () => void) {
      const lists = useSectionCategories(false);
      const [picks, setPicks] = useState<Partial<Record<CatalogSection, string[] | null>>>(
        () => stores.profilePrefs.getState().prefs[profileId]?.kidsCategories ?? {},
      );
      const chosen = picks[lists.section] ?? null;
      const picked = chosen ?? (lists.categories ?? []).filter((c) => isKidsCategory(c.name)).map((c) => c.id);
      return {
        ...lists,
        /** Chosen by the parent (false: the automatic choice). */
        chosen: chosen !== null,
        isPicked: (id: string) => picked.includes(id),
        toggle: (id: string) =>
          setPicks({ ...picks, [lists.section]: picked.includes(id) ? picked.filter((c) => c !== id) : [...picked, id] }),
        automatic: () => setPicks({ ...picks, [lists.section]: null }),
        async save() {
          await stores.profilePrefs.getState().update(profileId, { kidsCategories: picks });
          onClose();
        },
      };
    },

    /**
     * Account menu → Categories shown (D-110): unchecked categories leave the category bars, lists, Home rows and the
     * guide; search still finds them. Saved (and every list reloaded) on `save()`.
     */
    useHiddenCategories(onClose: () => void) {
      const profileId = useSession((s) => s.activeProfileId);
      const profileName = useSession((s) => selectActiveProfile(s)?.name ?? null);
      const saved = useAppStore(stores.profilePrefs, (s) => (profileId ? (s.prefs[profileId]?.hiddenCategories ?? {}) : {}));
      const lists = useSectionCategories(true);
      const [hidden, setHidden] = useState<Partial<Record<CatalogSection, string[]>>>(saved);
      const hiddenHere = hidden[lists.section] ?? [];
      return {
        ...lists,
        profileName,
        isShown: (id: string) => !hiddenHere.includes(id),
        /**
         * "Select all" (issue #120): checked while every category of the section is shown. Pressed, it shows all of
         * them, or hides all of them when all were shown, so a few can then be picked one by one.
         */
        allShown: hiddenHere.length === 0,
        toggleAll: () =>
          setHidden({ ...hidden, [lists.section]: hiddenHere.length === 0 ? (lists.categories ?? []).map((c) => c.id) : [] }),
        toggle: (id: string) =>
          setHidden({ ...hidden, [lists.section]: hiddenHere.includes(id) ? hiddenHere.filter((c) => c !== id) : [...hiddenHere, id] }),
        async save() {
          onClose();
          if (!profileId || JSON.stringify(hidden) === JSON.stringify(saved)) return;
          await stores.profilePrefs.getState().update(profileId, { hiddenCategories: hidden });
          reloadLists();
        },
      };
    },

    /**
     * Content language filter (D-063, D-067, D-086) of the active profile, or of `profile` (the profile editor): only
     * titles with audio or subtitles in a chosen language; none chosen = all. Applied on `close()`.
     */
    useLanguageSettings(profile: { id: string; name: string } | undefined, onClose: () => void) {
      const activeId = useSession((s) => s.activeProfileId);
      const activeName = useSession((s) => selectActiveProfile(s)?.name ?? null);
      const profileId = profile?.id ?? activeId;
      const profileName = profile?.name ?? activeName;
      const saved = useAppStore(stores.profilePrefs, (s) => (profileId ? profileLanguages(s.prefs[profileId]) : []));
      const [chosen, setChosen] = useState(saved);
      return {
        profileName,
        title: profileName ? t('Content language filter for {name}', { name: profileName }) : t('Content language filter'),
        chosen,
        toggle: (code: string) => setChosen((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code])),
        /** "All languages": no filter. */
        allLanguages: () => setChosen([]),
        close() {
          onClose();
          if (!profileId || chosen.join(',') === saved.join(',')) return;
          void stores.profilePrefs.getState().update(profileId, { languages: chosen, language: null }).then(reloadLists);
        },
      };
    },

    /** Live channels whose name matches a search, hidden categories included (D-110); null until they arrive. */
    /** The details panel's round "My List" toggle (D-055): plus to add, check when saved. */
    useWatchlistToggle(section: LibrarySection, title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>) {
      const saved = useAppStore(stores.watchlist, (s) => isOnWatchlist(s, section, title.id));
      return {
        saved,
        icon: saved ? ('check' as const) : ('plus' as const),
        label: saved ? t('Remove {title} from My List', { title: title.title }) : t('Add {title} to My List', { title: title.title }),
        hint: saved ? t('Remove from My List') : t('Add to My List'),
        toggle: () => void stores.watchlist.getState().toggle(section, title),
      };
    },

    /**
     * What the player knows about the playing title: for an episode, the episode lists of all versions of the series,
     * merged (D-066), so next-up and the episodes drawer run across versions; for a movie, its versions for the
     * selector. `revision`: loads again after a library update.
     */
    usePlayerTitle(target: PlayTarget, revision = 0) {
      const seriesMaster = useLibrary((s) => (target.masterId ? s.details[`series|${target.masterId}`] : undefined));
      useEffect(() => {
        if (target.kind === 'episode' && target.masterId) void stores.library.getState().loadDetails('series', target.masterId);
        if (target.kind === 'movie' && target.masterId) void stores.library.getState().loadDetails('movies', target.masterId);
      }, [target.kind, target.masterId, revision]);
      const seriesVersions = playerSeriesVersions(target, seriesMaster);
      const loadedVersions = useAsync(seriesVersions ? `series-versions:${seriesVersions.map((v) => v.seriesId).join(',')}` : null, () =>
        loadSeriesVersions(api, seriesVersions!),
      );
      const series = useMemo(
        () => (loadedVersions.data ? mergeSeriesVersions(loadedVersions.data, target.seriesId) : null),
        [loadedVersions.data, target.seriesId],
      );
      const variants = useLibrary((s) =>
        target.kind === 'movie' && target.masterId ? (s.details[`movies|${target.masterId}`]?.data?.variants ?? NO_VARIANTS) : NO_VARIANTS,
      );
      return {
        series,
        next: series && target.kind === 'episode' ? nextEpisode(series, target.streamId) : null,
        previous: series && target.kind === 'episode' ? previousEpisode(series, target.streamId) : null,
        variants,
      };
    },

    /**
     * Home's featured movie: a random one with a poster, its details, the version to play and its info (plot, backdrop,
     * trailer). `revision`: loads again after a library update.
     */
    useHeroTitle(candidates: MasterCard[], revision = 0) {
      const featured = useMemo(() => {
        const withArt = candidates.filter((item) => item.posterUrl);
        return withArt[Math.floor(Math.random() * withArt.length)] ?? candidates[0] ?? null;
      }, [candidates]);
      useEffect(() => {
        if (featured) void stores.library.getState().loadDetails('movies', featured.id);
      }, [featured, revision]);
      const details = useLibrary((s) => (featured ? (s.details[`movies|${featured.id}`]?.data ?? null) : null));
      const variant = useLibrary((s) => (details ? selectVariant(s, details) : null));
      const meta = useAsync(variant ? `movie:${variant.streamId}` : null, () => api.catalog.movie(variant!.streamId));
      const play = details && variant ? movieTarget(details, variant) : null;
      return { featured, meta, play, backdrop: meta.data?.backdropUrls[0] ?? featured?.posterUrl ?? null };
    },

    /**
     * A title's poster card: the "Watched" tag (finished movie, fully watched series, D-082), the year and version count,
     * and its menu (Go to details, My List, Mark as (not) watched, D-081). Each app draws the card and the menu.
     */
    useTitleCard(section: LibrarySection, item: MasterCard, openDetails: () => void) {
      const movieWatched = useProgress((s) => section === 'movies' && isMovieWatched(s.items.data ?? [], item.id));
      const profileId = useProgress((s) => s.profileId);
      const seriesWatched = useAppStore(stores.profilePrefs, (s) => section === 'series' && isSeriesWatched(s.prefs, profileId, item.id));
      const watched = movieWatched || seriesWatched;
      const onList = useAppStore(stores.watchlist, (s) => isOnWatchlist(s, section, item.id));
      const versions = item.variantCount > 1 ? tn('{count} version', '{count} versions', item.variantCount) : null;
      return {
        watched,
        badge: item.bestQuality === '4K' ? '4K' : null,
        subtitle: [item.year, versions].filter(Boolean).join(' · ') || null,
        menuItems: () =>
          cardMenuItems({ kind: section === 'movies' ? 'movie' : 'series', watched, onList }).map((entry) => ({
            id: entry.id,
            label: entry.label,
            run: () => {
              if (entry.id === 'details') openDetails();
              else if (entry.id === 'mylist-add' || entry.id === 'mylist-remove') void stores.watchlist.getState().toggle(section, item);
              else if (section === 'movies') void setMovieWatched(stores, item.id, entry.id === 'watched');
              else void setSeriesWatched({ api, ...stores }, item.id, entry.id === 'watched');
            },
          })),
      };
    },

    /** A "Continue watching" card's menu (D-081): Go to details, Mark as watched, My List, Remove from the row. */
    continueMenuItems(entry: ProgressDto, openDetails: (section: LibrarySection, masterId: string) => void) {
      const listed = continueWatchlistEntry(entry);
      const onList = !!listed && isOnWatchlist(stores.watchlist.getState(), listed.section, listed.card.id);
      return cardMenuItems({ kind: 'continue', entry, onList }).map((item) => ({
        id: item.id,
        label: item.label,
        run: () => {
          if (item.id === 'details') openDetails(entry.kind === 'episode' ? 'series' : 'movies', entry.masterId!);
          else if (item.id === 'watched') void markEntryWatched(stores.progress, entry);
          else if (item.id === 'mylist-add' || item.id === 'mylist-remove') {
            if (listed) void stores.watchlist.getState().toggle(listed.section, listed.card);
          } else void removeFromContinueWatching(stores.progress, entry);
        },
      }));
    },

    /**
     * Programmes of the full TV guide matching the search, on now first (issue #119): `[]` without a full guide, null
     * while searching.
     */
    useProgrammeSearch(query: string): ProgrammeMatch[] | null {
      const [found, setFound] = useState<ProgrammeMatch[] | null>(null);
      useEffect(() => {
        let cancelled = false;
        const search = api.catalog.searchProgrammes;
        if (!search) return setFound([]);
        setFound(null);
        search(query, { limit: MAX_SEARCH_PROGRAMMES }).then(
          (list) => !cancelled && setFound(list),
          () => !cancelled && setFound([]),
        );
        return () => {
          cancelled = true;
        };
      }, [query]);
      return found;
    },

    useRecentChannels,

    /** Notes the playing live channel in the active profile's recent channels once it starts (issue #122). */
    useNoteRecentChannel(target: PlayTarget) {
      const profileId = useSession((s) => s.activeProfileId);
      useEffect(() => {
        if (target.kind !== 'live' || !profileId) return;
        const prefs = stores.profilePrefs.getState();
        void prefs.update(profileId, { recentChannels: addRecentChannel(prefs.prefs[profileId]?.recentChannels, recentChannelOf(target)) });
        // A new channel, not a new object for the same one.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [target.kind, target.streamId, profileId]);
    },

    /**
     * Home's live row (issue #122): the channels the profile watched last; until there are any, the first live
     * category as before. `categoryId`: the category "See all" opens (none for recent channels).
     */
    useLiveHomeRow(enabled = true) {
      const recent = useRecentChannels();
      const categories = useAppStore(stores.catalog, (s) => s.categories.live?.data ?? null);
      const first = categories?.[0] ?? null;
      const channels = useAppStore(stores.catalog, (s) => (first ? (s.liveChannels[first.id]?.data ?? null) : null));
      const fallback = recent.length === 0;
      useEffect(() => {
        if (!fallback || !enabled) return;
        void stores.catalog
          .getState()
          .loadCategories('live')
          .then((loaded) => {
            if (loaded?.[0]) void stores.catalog.getState().loadLiveChannels(loaded[0].id);
          });
      }, [fallback, enabled]);
      if (!fallback) return { title: t('Recently watched channels'), channels: recent, categoryId: null, recent: true as const };
      return {
        title: first ? t('Live TV: {name}', { name: first.name }) : t('Live TV'),
        channels: (channels ?? []) as RecentChannel[],
        categoryId: first?.id ?? null,
        recent: false as const,
      };
    },

    useChannelSearch(query: string): LiveChannel[] | null {
      const [channels, setChannels] = useState<LiveChannel[] | null>(null);
      useEffect(() => {
        let cancelled = false;
        const needle = query.toLowerCase();
        // Search also finds channels in hidden categories (D-110). The database finds the matches (D-123); the filter here
        // is for an API that ignores `search`.
        api.catalog.liveChannels(null, undefined, { includeHidden: true, search: needle, limit: MAX_SEARCH_CHANNELS }).then(
          (all) =>
            !cancelled && setChannels(all.filter((channel) => channel.name.toLowerCase().includes(needle)).slice(0, MAX_SEARCH_CHANNELS)),
          () => !cancelled && setChannels([]),
        );
        return () => {
          cancelled = true;
        };
      }, [query]);
      return channels;
    },

    /** Whether downloads may play (subscription active, online within 30 days). D-050. */
    useOfflineAccess() {
      const expiresAt = useSession((s) => s.account?.expiresAt ?? null);
      const lastOnlineAt = useSession((s) => s.lastOnlineAt);
      return offlineAccess({ expiresAt }, lastOnlineAt);
    },

    /**
     * Library titles loaded page by page: `loadMore()` fetches the next page (rows and grids call it near their end).
     * Nothing loads until `enabled` (rows that wait until they are on screen). Without `sort` the default order applies
     * (D-049). A new filter starts again from the first page.
     */
    usePagedLibrary(
      section: LibrarySection,
      filter: { categoryId?: string | null; search?: string | null; sort?: LibrarySortChoice | null },
      pageSize: number,
      enabled = true,
    ) {
      const categoryId = filter.categoryId ?? null;
      const search = filter.search || null;
      const sort = filter.sort?.sort;
      const order = filter.sort?.order;
      const [pages, setPages] = useState(1);
      const query = (page: number) => ({ categoryId, search, limit: pageSize, offset: page * pageSize, sort, order });
      const resources = useLibrary((s) => Array.from({ length: pages }, (_, page) => s.pages[pageKey(section, query(page))]));

      useEffect(() => setPages(1), [section, categoryId, search, sort, order]);
      useEffect(() => {
        if (enabled) void stores.library.getState().loadPage(section, query(pages - 1));
        // query is derived from section, category, search, sort and the page size.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [section, categoryId, search, sort, order, pages, enabled]);

      const items: MasterCard[] = resources.flatMap((resource) => resource?.data?.items ?? []);
      const total = resources[0]?.data?.total ?? 0;
      const last = resources[resources.length - 1];
      // Not asked yet counts as loading: a spinner until the first answer, not an empty list.
      const loading = !last || last.status === 'loading' || last.status === 'idle';
      return {
        items,
        total,
        /** Orders the library has data for (from the first page); null until it loads. */
        sorts: resources[0]?.data?.sorts ?? null,
        /** First page not in yet. */
        loadingFirst: pages === 1 && loading,
        loadingMore: pages > 1 && loading,
        done: resources[0]?.status === 'success' && items.length >= total,
        error: last?.status === 'error' ? last.error : null,
        hasMore: items.length < total,
        loadMore: () => {
          if (!loading && items.length < total) setPages((count) => count + 1);
        },
      };
    },
  };
}

export type AppHooks = ReturnType<typeof createAppHooks>;

/** Most profiles per account. */
export const MAX_PROFILES = 5;

/**
 * Asks for the parental PIN when `needed` (each app's own dialog, D-054), then runs `then`; without the need it runs at
 * once.
 */
export type PinGate = (needed: boolean, prompt: string, then: () => void) => void;

const asyncCache = new Map<string, unknown>();

export interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/** Loads `key` once per app session (module cache). `key` null = idle. For ad-hoc reads outside the shared stores. */
export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncResult<T> {
  const [state, setState] = useState<AsyncResult<T>>(() =>
    key && asyncCache.has(key)
      ? { data: asyncCache.get(key) as T, loading: false, error: null }
      : { data: null, loading: !!key, error: null },
  );

  useEffect(() => {
    if (!key) return setState({ data: null, loading: false, error: null });
    if (asyncCache.has(key)) return setState({ data: asyncCache.get(key) as T, loading: false, error: null });
    let active = true;
    setState({ data: null, loading: true, error: null });
    load().then(
      (data) => {
        asyncCache.set(key, data);
        if (active) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (active)
          setState({ data: null, loading: false, error: error instanceof ApiError ? error : new ApiError(0, 'http_error', String(error)) });
      },
    );
    return () => {
      active = false;
    };
    // `load` is expected to change with `key`; keying on it alone avoids refetch loops from inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
