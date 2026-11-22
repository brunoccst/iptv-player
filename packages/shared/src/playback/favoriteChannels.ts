import type { LiveChannel } from '../api/types';

/** A live channel the user marked as a favorite. */
export type FavoriteChannel = Pick<LiveChannel, 'id' | 'name' | 'logoUrl' | 'categoryId' | 'number'>;

/** Maximum number of favorite channels per profile. */
export const MAX_FAVORITE_CHANNELS = 100;

/** Check if a channel is in the favorites list. */
export function isFavoriteChannel(favorites: FavoriteChannel[] | null | undefined, channelId: string): boolean {
  return (favorites ?? []).some((c) => c.id === channelId);
}

/** Toggle a channel in the favorites list. */
export function toggleFavoriteChannel(list: FavoriteChannel[] | null | undefined, channel: FavoriteChannel): FavoriteChannel[] {
  const current = list ?? [];
  const index = current.findIndex((c) => c.id === channel.id);
  if (index >= 0) {
    // Remove it
    return current.filter((c) => c.id !== channel.id);
  }
  // Add it at the beginning (newest first)
  return [channel, ...current].slice(0, MAX_FAVORITE_CHANNELS);
}
