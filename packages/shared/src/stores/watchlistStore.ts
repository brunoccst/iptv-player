import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { ApiError } from '../api/errors';
import type { LibrarySection, MasterCard, MasterDetails, WatchlistDto } from '../api/types';
import { coverQuality, qualityInLanguages, type LanguageScope } from '../profiles/contentLanguages';
import { emptyResource, toApiError, type Resource } from './resource';
import { t } from '../i18n/i18n';

/** "My List" of the active profile (D-055). Adding and removing update the list before the server answers. */
export interface WatchlistState {
  profileId: string | null;
  items: Resource<WatchlistDto[]>;
  saveError: ApiError | null;
  /** `quiet`: keeps the shown list until the new one is read (a refresh after a sync, issue #227). */
  load(profileId: string, options?: { force?: boolean; quiet?: boolean }): Promise<void>;
  /** Adds the title when missing, removes it when present. */
  toggle(section: LibrarySection, card: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>): Promise<void>;
  /**
   * Reads every entry's quality again (after a library update or a change of the profile's languages), which may reveal
   * upgrades (DECISIONS.md#d-176).
   */
  recheckQuality(): Promise<void>;
  /** The upgrades were shown: they are not shown again unless the title turns into a cinema copy once more. */
  dismissUpgrades(entries: WatchlistDto[]): Promise<void>;
  reset(): void;
}

export const isOnWatchlist = (state: Pick<WatchlistState, 'items'>, section: LibrarySection, masterId: string) =>
  (state.items.data ?? []).some((item) => item.section === section && item.masterId === masterId);

/**
 * A saved entry shown like a library card (rows and the My List page), with the quality badge and versions the library
 * gives it once read (issue: My List covers had no 4K or TS badge).
 */
export const watchlistCard = (item: WatchlistDto): MasterCard => ({
  id: item.masterId,
  title: item.title,
  year: item.year,
  posterUrl: item.posterUrl,
  rating: item.quality?.rating ?? null,
  bestQuality: item.quality?.bestQuality ?? null,
  lowSource: item.quality?.lowSource ?? null,
  variantCount: item.quality?.variantCount ?? 1,
});

const qualityOf = (details: MasterDetails, scope: LanguageScope | null): NonNullable<WatchlistDto['quality']> => ({
  ...coverQuality(details.variants, scope),
  rating: details.rating,
  variantCount: details.variants.length,
  ...(scope ? { inLanguages: qualityInLanguages(details.variants, scope) } : {}),
});

/**
 * The quality an upgrade is judged by (DECISIONS.md#d-233): of the versions in the profile's languages, of all without
 * languages; null when the title has none in them.
 */
const judgedQuality = (item: WatchlistDto) => (item.quality?.inLanguages === undefined ? (item.quality ?? null) : item.quality.inLanguages);

const entryKey = (item: Pick<WatchlistDto, 'section' | 'masterId'>) => `${item.section}:${item.masterId}`;

/** The popup's line for an upgraded title: "Now 1080p, was TS". */
export const upgradeLine = (item: WatchlistDto): string => {
  const best = judgedQuality(item)?.bestQuality;
  return best
    ? t('Now {quality}, was {source}', { quality: best, source: item.lowSourceSeen ?? '' })
    : t('Better copy, was {source}', { source: item.lowSourceSeen ?? '' });
};

/**
 * Titles on My List that were seen as cinema copies only (CAM, TS, TC, SCR) and now have a better copy, oldest
 * first (DECISIONS.md#d-176). Any copy without a cinema tag counts as better, as for the cover's badge; with profile
 * languages, only copies in them (DECISIONS.md#d-233).
 */
export const qualityUpgrades = (items: WatchlistDto[] | null): WatchlistDto[] =>
  (items ?? [])
    .filter((item) => {
      const quality = judgedQuality(item);
      return !!item.lowSourceSeen && !!quality && !quality.lowSource;
    })
    .reverse();

export function createWatchlistStore({
  api,
  now = () => new Date().toISOString(),
  languageScope = () => Promise.resolve(null),
}: {
  api: ApiClient;
  now?: () => string;
  /** The open profile's languages, which quality tags and upgrades go by (DECISIONS.md#d-233); null for all. */
  languageScope?: (section: LibrarySection) => Promise<LanguageScope | null>;
}) {
  return createStore<WatchlistState>()((set, get) => {
    let inFlight: { profileId: string; promise: Promise<void> } | null = null;
    const setData = (data: WatchlistDto[]) => set({ items: { ...get().items, data } });

    /** Saves which cinema copy each title is now, so a later better copy can be announced (DECISIONS.md#d-176). */
    const noteLowSources = async (profileId: string) => {
      const marks = (get().items.data ?? []).filter((item) => {
        const low = judgedQuality(item)?.lowSource;
        return low && low !== item.lowSourceSeen;
      });
      if (marks.length === 0) return;
      const seen = new Map(marks.map((item) => [entryKey(item), judgedQuality(item)!.lowSource!]));
      setData(
        (get().items.data ?? []).map((item) => (seen.has(entryKey(item)) ? { ...item, lowSourceSeen: seen.get(entryKey(item)) } : item)),
      );
      await api.watchlist
        .noteLowSources(
          profileId,
          marks.map((item) => ({ section: item.section, masterId: item.masterId, lowSource: seen.get(entryKey(item))! })),
        )
        .catch(() => undefined);
    };

    /**
     * Reads the quality of the entries that lack it (or of all, after a library update) from the library, all at once,
     * and shows it in one update.
     */
    const readQuality = async (profileId: string, all = false) => {
      const missing = (get().items.data ?? []).filter((item) => all || !item.quality);
      if (missing.length === 0) return;
      const found = new Map<string, WatchlistDto['quality']>();
      const scopes = new Map<LibrarySection, Promise<LanguageScope | null>>();
      const scopeOf = (section: LibrarySection) => {
        if (!scopes.has(section))
          scopes.set(
            section,
            languageScope(section).catch(() => null),
          );
        return scopes.get(section)!;
      };
      await Promise.all(
        missing.map((item) =>
          Promise.all([api.library.get(item.section, item.masterId), scopeOf(item.section)]).then(
            ([details, scope]) => found.set(entryKey(item), qualityOf(details, scope)),
            // A title gone from the library keeps a plain cover.
            () => undefined,
          ),
        ),
      );
      if (found.size === 0 || get().profileId !== profileId) return;
      setData(
        (get().items.data ?? []).map((item) =>
          (item.quality && !all) || !found.has(entryKey(item)) ? item : { ...item, quality: found.get(entryKey(item)) },
        ),
      );
      await noteLowSources(profileId);
    };

    return {
      profileId: null,
      items: emptyResource(),
      saveError: null,

      load(profileId, { force = false, quiet = false } = {}) {
        const { items, profileId: current } = get();
        if (!force && current === profileId) {
          if (inFlight?.profileId === profileId) return inFlight.promise;
          if (items.status === 'success') return Promise.resolve();
        }
        if (!(quiet && current === profileId && items.status === 'success'))
          set({ profileId, items: { ...emptyResource(), status: 'loading' } });
        const promise = api.watchlist
          .list(profileId)
          .then(
            (data) => {
              if (get().profileId !== profileId) return;
              set({ items: { data, status: 'success', error: null, updatedAt: Date.now() } });
              void readQuality(profileId);
            },
            (error: unknown) => {
              if (get().profileId === profileId) set({ items: { ...get().items, status: 'error', error: toApiError(error) } });
            },
          )
          .finally(() => {
            if (inFlight?.promise === promise) inFlight = null;
          });
        inFlight = { profileId, promise };
        return promise;
      },

      async toggle(section, card) {
        const { profileId } = get();
        if (!profileId) return;
        const before = get().items.data ?? [];
        const present = isOnWatchlist(get(), section, card.id);
        setData(
          present
            ? before.filter((item) => !(item.section === section && item.masterId === card.id))
            : [{ section, masterId: card.id, title: card.title, year: card.year, posterUrl: card.posterUrl, addedAt: now() }, ...before],
        );
        try {
          if (present) await api.watchlist.remove(profileId, section, card.id);
          else await api.watchlist.add(profileId, section, card.id, { title: card.title, year: card.year, posterUrl: card.posterUrl });
          set({ saveError: null });
          if (!present) void readQuality(profileId);
        } catch (error) {
          if (get().profileId === profileId) setData(before);
          set({ saveError: toApiError(error) });
        }
      },

      async recheckQuality() {
        const { profileId, items } = get();
        if (profileId && items.status === 'success') await readQuality(profileId, true);
      },

      async dismissUpgrades(entries) {
        const { profileId } = get();
        if (!profileId || entries.length === 0) return;
        const done = new Set(entries.map(entryKey));
        setData(
          (get().items.data ?? []).map((item) => {
            if (!done.has(entryKey(item))) return item;
            const { lowSourceSeen: _, ...rest } = item;
            return rest;
          }),
        );
        await api.watchlist
          .noteLowSources(
            profileId,
            entries.map((item) => ({ section: item.section, masterId: item.masterId, lowSource: null })),
          )
          .catch(() => undefined);
      },

      reset() {
        inFlight = null;
        set({ profileId: null, items: emptyResource(), saveError: null });
      },
    };
  });
}

export type WatchlistStore = ReturnType<typeof createWatchlistStore>;
