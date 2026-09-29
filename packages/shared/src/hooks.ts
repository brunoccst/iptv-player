import { useEffect, useMemo, useState } from 'react';
import { ApiError } from './api/errors';
import type { LibrarySection, MasterCard, MasterDetails, ProfileDto, ProgressDto } from './api/types';
import type { AppContext } from './appContext';
import { offlineAccess } from './playback/offlineAccess';
import { AVATAR_COLORS, avatarColor } from './design/avatar';
import { needsPinToManage, needsPinToOpen } from './stores/pinStore';
import { t } from './i18n/i18n';
import { chooseVersion } from './playback/playbackChoices';
import { loadSeriesVersions, mergeSeriesVersions, seriesVersionsOf } from './playback/seriesVersions';
import { episodeTarget, movieTarget, progressTarget } from './playback/targets';
import { allEpisodesWatched, isMovieWatched, noteSeriesWatched, setMovieWatched } from './playback/watched';
import { useAppStore } from './react';
import type { CatalogState } from './stores/catalogStore';
import { pageKey, selectVariant, type LibrarySortChoice, type LibraryState } from './stores/libraryStore';
import type { PinState } from './stores/pinStore';
import type { ProfilePrefsState } from './stores/profilePrefsStore';
import type { ProgressState } from './stores/progressStore';
import type { SessionState } from './stores/sessionStore';
import type { WatchlistState } from './stores/watchlistStore';

/**
 * Hooks the TV/phone app and the desktop/web app share (D-124): the same state, loading and paging for both; each app
 * only draws. Made once per app from its stores: `export const { useSession, usePagedLibrary } = createAppHooks(stores)`.
 */
export function createAppHooks({ api, stores }: Pick<AppContext, 'api' | 'stores'>) {
  const useSession = <T>(selector: (state: SessionState) => T) => useAppStore(stores.session, selector);
  const useLibrary = <T>(selector: (state: LibraryState) => T) => useAppStore(stores.library, selector);
  const useProgress = <T>(selector: (state: ProgressState) => T) => useAppStore(stores.progress, selector);

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
