import type { MasterDetails, ProgressDto, ProgressKind, ProgressRequest } from '../api/types';
import type { LibraryStore } from '../stores/libraryStore';
import { selectVariant } from '../stores/libraryStore';
import type { ProgressStore } from '../stores/progressStore';
import { continueWatchingEntries, isCompleted } from './rules';

/**
 * Watched titles (D-081): the "Watched" tag on covers and in details, and the card menu's "Mark as watched". One set of
 * rules for every app; the screens only draw it. A title is watched when its saved progress is finished (D-042 rules:
 * 95 % played or under 2 minutes left); marking it watched saves finished progress.
 */

export const isWatched = (progress: Pick<ProgressDto, 'positionSeconds' | 'durationSeconds'> | null | undefined) =>
  !!progress && isCompleted(progress.positionSeconds, progress.durationSeconds);

/** Progress entries of a movie title (any of its versions). */
export const movieEntries = (items: ProgressDto[], masterId: string) =>
  items.filter((item) => item.kind === 'movie' && item.masterId === masterId);

/** A movie title is watched when any of its versions was finished. */
export const isMovieWatched = (items: ProgressDto[], masterId: string) => movieEntries(items, masterId).some(isWatched);

/** Finished progress for a title that may never have played: without a known runtime, 1 of 1 second counts as done. */
export function watchedRequest(
  entry: Omit<ProgressRequest, 'positionSeconds' | 'durationSeconds'> & { durationSeconds?: number | null },
): ProgressRequest {
  const duration = entry.durationSeconds && entry.durationSeconds > 0 ? entry.durationSeconds : 1;
  return { ...entry, positionSeconds: duration, durationSeconds: duration };
}

/** Marks a movie title watched (its chosen or first version) or not watched (all its versions' progress removed). */
export async function setMovieWatched(
  stores: { library: LibraryStore; progress: ProgressStore },
  masterId: string,
  watched: boolean,
): Promise<void> {
  const progress = stores.progress.getState();
  if (!watched) {
    for (const entry of movieEntries(progress.items.data ?? [], masterId)) await progress.remove('movie', entry.itemId);
    return;
  }
  const details: MasterDetails | null = await stores.library.getState().loadDetails('movies', masterId);
  if (!details) return;
  const variant = selectVariant(stores.library.getState(), details);
  if (!variant) return;
  const existing = movieEntries(progress.items.data ?? [], masterId).find((entry) => entry.itemId === variant.streamId);
  await progress.save(
    'movie',
    variant.streamId,
    watchedRequest({
      title: details.title,
      masterId,
      posterUrl: details.posterUrl,
      containerExtension: variant.containerExtension,
      durationSeconds: existing?.durationSeconds,
    }),
  );
}

/** Marks one Continue Watching entry (a movie or an episode) as finished. */
export function markEntryWatched(progress: ProgressStore, entry: ProgressDto): Promise<void> {
  return progress.getState().save(
    entry.kind as ProgressKind,
    entry.itemId,
    watchedRequest({
      title: entry.title,
      masterId: entry.masterId,
      seriesId: entry.seriesId,
      seasonNumber: entry.seasonNumber,
      episodeNumber: entry.episodeNumber,
      posterUrl: entry.posterUrl,
      containerExtension: entry.containerExtension,
      durationSeconds: entry.durationSeconds,
    }),
  );
}

/** Removes a Continue Watching entry: for a series, all its unfinished episodes (D-078). */
export async function removeFromContinueWatching(progress: ProgressStore, entry: ProgressDto): Promise<void> {
  for (const item of continueWatchingEntries(progress.getState().items.data ?? [], entry))
    await progress.getState().remove(item.kind as ProgressKind, item.itemId);
}

/** What a card's menu offers (D-078, D-081). The apps turn each id into an action and a button or menu item. */
export type CardMenuItemId = 'details' | 'watched' | 'unwatched' | 'remove';
export interface CardMenuItem {
  id: CardMenuItemId;
  label: string;
}

export function cardMenuItems(
  card: { kind: 'continue'; entry: ProgressDto } | { kind: 'movie'; watched: boolean } | { kind: 'series' },
): CardMenuItem[] {
  const details: CardMenuItem = { id: 'details', label: 'Go to details' };
  switch (card.kind) {
    case 'continue':
      return [
        // An episode started without its series title (from search or the guide) has no details page to go to.
        ...(card.entry.masterId ? [details] : []),
        { id: 'watched', label: card.entry.kind === 'episode' ? 'Mark episode as watched' : 'Mark as watched' },
        { id: 'remove', label: 'Remove from Continue Watching' },
      ];
    case 'movie':
      return [details, card.watched ? { id: 'unwatched', label: 'Mark as not watched' } : { id: 'watched', label: 'Mark as watched' }];
    case 'series':
      return [details];
  }
}

/** The tag's text (bottom right of a cover, next to the title in details). */
export const WATCHED_LABEL = 'Watched';
