import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { MasterDetails, VariantInfo } from '../api/types';
import { t } from '../i18n/i18n';
import { categoryLanguages } from '../profiles/contentLanguages';
import { loadSeriesVersions } from '../playback/seriesVersions';
import type { ProgressStore } from './progressStore';
import { profileLanguages, type ProfilePrefsStore } from './profilePrefsStore';

/** A series the profile watched that has a season newer than the last one it knew of (DECISIONS.md#d-234). */
export interface NewSeason {
  masterId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  /** The newest season now. */
  season: number;
  /** The newest season known before. */
  seen: number;
}

export interface NewSeasonsState {
  profileId: string | null;
  items: NewSeason[];
  /** Reads the seasons of every series the profile watched (on open, profile change and after a library update). */
  check(profileId: string): Promise<void>;
  /** The popup was shown: these seasons are known now. */
  dismiss(): Promise<void>;
  reset(): void;
}

/** The popup's line: "Season 3 is out" or, when several came, "Seasons 3 to 4 are out". */
export const newSeasonLine = (item: Pick<NewSeason, 'season' | 'seen'>): string =>
  item.season - item.seen > 1
    ? t('Seasons {first} to {last} are out', { first: item.seen + 1, last: item.season })
    : t('Season {number} is out', { number: item.season });

/**
 * Whether a version counts for the profile's content languages (D-063): its audio or subtitles are in one of them, or
 * it has no language of its own and its category names none of the others.
 */
export function versionInLanguages(
  variant: Pick<VariantInfo, 'audioLanguages' | 'subtitleLanguages' | 'categoryId'>,
  languages: string[],
  categoryNames: Map<string, string>,
): boolean {
  if (languages.length === 0) return true;
  const own = [...variant.audioLanguages, ...variant.subtitleLanguages].map((code) => code.toUpperCase());
  if (own.length > 0) return own.some((code) => languages.includes(code));
  const named = categoryLanguages(categoryNames.get(variant.categoryId ?? '') ?? '');
  return named.length === 0 || named.some((code) => languages.includes(code));
}

/** The series (master ids) the profile watched: an episode with progress, or marked watched (D-081). */
export function watchedSeriesIds(progress: { kind: string; masterId: string | null }[], marked: readonly string[]): string[] {
  const ids = progress.filter((entry) => entry.kind === 'episode' && entry.masterId).map((entry) => entry.masterId!);
  return [...new Set([...ids, ...marked])];
}

/** Series read one after another, each with its versions three at a time (`loadSeriesVersions`). */
async function newestSeason(api: Pick<ApiClient, 'catalog'>, details: MasterDetails, keep: (variant: VariantInfo) => boolean) {
  const versions = details.variants.filter(keep).map((variant) => ({ seriesId: variant.streamId, label: variant.label }));
  if (versions.length === 0) return null;
  const loaded = await loadSeriesVersions(api, versions);
  const numbers = loaded.flatMap((version) =>
    version.details.seasons.filter((season) => season.episodes.length > 0).map((season) => season.number),
  );
  return numbers.length ? Math.max(...numbers) : null;
}

/**
 * New seasons of watched series, for the popup Home shows (DECISIONS.md#d-234). The newest season of each is kept in
 * the profile's preferences (`seasonsSeen`): a series met for the first time is only noted; a newer season later is
 * announced until the popup closes.
 */
export function createNewSeasonsStore({
  api,
  progress,
  profilePrefs,
}: {
  api: Pick<ApiClient, 'library' | 'catalog'>;
  progress: ProgressStore;
  profilePrefs: ProfilePrefsStore;
}) {
  return createStore<NewSeasonsState>()((set, get) => {
    let running: Promise<void> | null = null;
    let again = false;

    const run = async (profileId: string) => {
      // Notes written before the saved preferences are read would replace them.
      if (!profilePrefs.getState().loaded) await profilePrefs.getState().load();
      await progress.getState().load(profileId);
      if (progress.getState().profileId !== profileId) return;
      const entries = progress.getState().items.data ?? [];
      const prefs = profilePrefs.getState().prefs[profileId];
      const ids = watchedSeriesIds(entries, prefs?.watchedSeries ?? []);
      if (ids.length === 0) return set({ items: [] });
      const languages = profileLanguages(prefs);
      const categoryNames = new Map(
        languages.length ? (await api.catalog.categories('series').catch(() => [])).map((category) => [category.id, category.name]) : [],
      );
      const found: NewSeason[] = [];
      const noted: Record<string, number> = {};
      for (const masterId of ids) {
        if (get().profileId !== profileId) return;
        const details = await api.library.get('series', masterId).catch(() => null);
        if (!details) continue;
        const season = await newestSeason(api, details, (variant) => versionInLanguages(variant, languages, categoryNames)).catch(
          () => null,
        );
        if (season == null) continue;
        const seen = profilePrefs.getState().prefs[profileId]?.seasonsSeen?.[masterId];
        // Already watching the new season (on another device, say): nothing to announce.
        const started = entries.some((entry) => entry.masterId === masterId && (entry.seasonNumber ?? 0) >= season);
        if (seen == null || started) {
          if (seen == null || season > seen) noted[masterId] = season;
        } else if (season > seen) {
          found.push({ masterId, title: details.title, year: details.year, posterUrl: details.posterUrl, season, seen });
        }
      }
      if (get().profileId !== profileId) return;
      if (Object.keys(noted).length) {
        const current = profilePrefs.getState().prefs[profileId]?.seasonsSeen ?? {};
        await profilePrefs.getState().update(profileId, { seasonsSeen: { ...current, ...noted } });
      }
      set({ items: found });
    };

    return {
      profileId: null,
      items: [],

      async check(profileId) {
        if (get().profileId !== profileId) set({ profileId, items: [] });
        if (running) {
          again = true;
          return running;
        }
        running = (async () => {
          do {
            again = false;
            await run(get().profileId ?? profileId).catch(() => undefined);
          } while (again && get().profileId);
        })().finally(() => {
          running = null;
        });
        return running;
      },

      async dismiss() {
        const { profileId, items } = get();
        if (!profileId || items.length === 0) return;
        set({ items: [] });
        const current = profilePrefs.getState().prefs[profileId]?.seasonsSeen ?? {};
        const seen = Object.fromEntries(items.map((item) => [item.masterId, Math.max(item.season, current[item.masterId] ?? 0)]));
        await profilePrefs.getState().update(profileId, { seasonsSeen: { ...current, ...seen } });
      },

      reset() {
        again = false;
        set({ profileId: null, items: [] });
      },
    };
  });
}

export type NewSeasonsStore = ReturnType<typeof createNewSeasonsStore>;
