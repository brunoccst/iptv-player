import type { KeyValueStorage } from '../stores/storage';
import { parseJson } from '../utils/bytes';

/**
 * What was removed on this device and when (issue #227, DECISIONS.md#d-186): deleted profiles, progress taken off
 * Continue watching, titles taken off My List. Syncing with another device (D-060) needs them, or a removed entry
 * would come back from the device that still has it. Entries older than `KEEP_REMOVALS_MS` are dropped: a device not
 * synced for that long brings its entries back.
 */
export interface Removals {
  /** Profile id → when it was deleted. */
  profiles: Record<string, string>;
  /** Profile id → `kind:itemId` → when it was removed. */
  progress: Record<string, Record<string, string>>;
  /** Profile id → `section:masterId` → when it was removed. */
  watchlist: Record<string, Record<string, string>>;
}

export const removalsKey = (accountId: string) => `direct.removed.${accountId}`;
export const KEEP_REMOVALS_MS = 180 * 24 * 3600_000;
/** Per profile and list; the oldest drop out first. */
const MAX_REMOVALS = 1000;

export const emptyRemovals = (): Removals => ({ profiles: {}, progress: {}, watchlist: {} });

export function readRemovals(text: string | null | undefined): Removals {
  const value = parseJson<Partial<Removals>>(text ?? null);
  return {
    profiles: { ...(value?.profiles ?? {}) },
    progress: { ...(value?.progress ?? {}) },
    watchlist: { ...(value?.watchlist ?? {}) },
  };
}

const prune = (entries: Record<string, string>, now: Date): Record<string, string> => {
  const oldest = new Date(now.getTime() - KEEP_REMOVALS_MS).toISOString();
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([, at]) => at >= oldest)
      .sort((a, b) => (a[1] < b[1] ? 1 : -1))
      .slice(0, MAX_REMOVALS),
  );
};

/** Drops entries older than `KEEP_REMOVALS_MS` and empty profiles. */
export function pruneRemovals(removals: Removals, now = new Date()): Removals {
  const nested = (byProfile: Record<string, Record<string, string>>) =>
    Object.fromEntries(
      Object.entries(byProfile)
        .map(([profileId, entries]) => [profileId, prune(entries, now)] as const)
        .filter(([, entries]) => Object.keys(entries).length > 0),
    );
  return { profiles: prune(removals.profiles, now), progress: nested(removals.progress), watchlist: nested(removals.watchlist) };
}

/** Records one removal. */
export async function noteRemoval(
  storage: KeyValueStorage,
  accountId: string,
  removal: { profile: string } | { list: 'progress' | 'watchlist'; profileId: string; key: string },
  now = new Date(),
): Promise<void> {
  const removals = readRemovals(await storage.getItem(removalsKey(accountId)));
  const at = now.toISOString();
  if ('profile' in removal) {
    removals.profiles[removal.profile] = at;
    delete removals.progress[removal.profile];
    delete removals.watchlist[removal.profile];
  } else {
    removals[removal.list][removal.profileId] = { ...(removals[removal.list][removal.profileId] ?? {}), [removal.key]: at };
  }
  await storage.setItem(removalsKey(accountId), JSON.stringify(pruneRemovals(removals, now)));
}
