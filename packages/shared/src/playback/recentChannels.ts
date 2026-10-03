import type { LiveChannel } from '../api/types';
import { liveTarget, type PlayTarget } from './targets';

/** A channel a profile watched (issue #122, D-129): enough to show its card and play it again. */
export type RecentChannel = Pick<LiveChannel, 'id' | 'name' | 'logoUrl' | 'categoryId'>;

/** How many channels each profile keeps, newest first. */
export const MAX_RECENT_CHANNELS = 20;
/** How many the live player's history overlay lists. */
export const RECENT_CHANNELS_IN_PLAYER = 10;

/** The playing channel of a live target. */
export const recentChannelOf = (target: PlayTarget): RecentChannel => ({
  id: target.streamId,
  name: target.title,
  logoUrl: target.posterUrl ?? null,
  categoryId: target.categoryId ?? null,
});

/** `channel` first, without an older entry of the same channel, at most `MAX_RECENT_CHANNELS`. */
export function addRecentChannel(list: RecentChannel[] | null | undefined, channel: RecentChannel): RecentChannel[] {
  return [channel, ...(list ?? []).filter((c) => c.id !== channel.id)].slice(0, MAX_RECENT_CHANNELS);
}

/** What the player needs to tune to a recent channel. */
export const recentChannelTarget = (channel: RecentChannel): PlayTarget =>
  liveTarget({ ...channel, epgChannelId: null, hasCatchup: false, number: null });
