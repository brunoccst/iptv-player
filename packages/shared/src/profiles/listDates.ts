import { KEEP_REMOVALS_MS } from '../direct/removals';
import { MAX_RECENT_CHANNELS, type RecentChannel } from '../playback/recentChannels';
import type { Reminder } from '../playback/reminders';
import type { ProfilePrefs } from '../stores/profilePrefsStore';

/**
 * Dates for the profile lists devices join (DECISIONS.md#d-229): when each watched-series mark and each reminder was
 * last set or taken off, and when each recent channel was last watched. A sync keeps the later change of each entry,
 * so a series marked not watched or a cancelled reminder stays that way, and recent channels sort by when they were
 * really watched on any device. Entries with no date on either side (saved before) are joined, as before.
 */
export type DatedList = 'watchedSeries' | 'reminders' | 'recentChannels';
export type ListDates = Partial<Record<DatedList, Record<string, string>>>;

const DATED_LISTS: DatedList[] = ['watchedSeries', 'reminders', 'recentChannels'];

export const reminderKey = (reminder: Pick<Reminder, 'channel' | 'start'>) => `${reminder.channel.id}|${reminder.start}`;

const keysOf = (list: DatedList, prefs: ProfilePrefs | undefined): string[] => {
  if (list === 'watchedSeries') return prefs?.watchedSeries ?? [];
  if (list === 'reminders') return (prefs?.reminders ?? []).map(reminderKey);
  return (prefs?.recentChannels ?? []).map((channel) => channel.id);
};

/** A reminder's date is kept until a day after its programme started; a watched-series removal as long as other removals. */
function pruneDates(list: DatedList, dates: Record<string, string>, kept: readonly string[], now: number): Record<string, string> {
  const present = new Set(kept);
  const oldest = new Date(now - KEEP_REMOVALS_MS).toISOString();
  return Object.fromEntries(
    Object.entries(dates).filter(([key, at]) => {
      if (list === 'recentChannels') return present.has(key);
      if (list === 'reminders') return Date.parse(key.slice(key.lastIndexOf('|') + 1)) > now - 24 * 3600_000;
      return present.has(key) || at >= oldest;
    }),
  );
}

/**
 * The list dates after `patch` changes this device's preferences at `at`: entries added or taken off get `at`, and so
 * does the channel now first in recent channels (just watched). Undefined when the patch changes none of these lists.
 */
export function stampListDates(current: ProfilePrefs | undefined, patch: Partial<ProfilePrefs>, at: string): ListDates | undefined {
  const lists = DATED_LISTS.filter((list) => list in patch);
  if (!lists.length) return undefined;
  const now = Date.parse(at);
  const dates: ListDates = { ...current?.listChangedAt };
  for (const list of lists) {
    const before = new Set(keysOf(list, current));
    const after = keysOf(list, { [list]: patch[list] });
    const stamped = { ...dates[list] };
    for (const key of after) if (!before.has(key)) stamped[key] = at;
    if (list === 'recentChannels') {
      if (after[0] !== undefined && after[0] !== keysOf(list, current)[0]) stamped[after[0]] = at;
    } else {
      const kept = new Set(after);
      for (const key of before) if (!kept.has(key)) stamped[key] = at;
    }
    dates[list] = pruneDates(list, stamped, after, now);
  }
  return dates;
}

/**
 * One list from both devices: per entry, the side that changed it later decides whether it is there (a side that has
 * the entry undated counts as the earliest). Entries neither side dated are joined. `phone` wins a tie.
 */
function mergeDated<T>(
  phone: readonly T[],
  local: readonly T[],
  phoneAt: Record<string, string>,
  localAt: Record<string, string>,
  keyOf: (item: T) => string,
): T[] {
  const sides = [phone, local].map((items, index) => ({
    items: new Map(items.map((item) => [keyOf(item), item])),
    at: index === 0 ? phoneAt : localAt,
  }));
  const keys = new Set(sides.flatMap(({ items, at }) => [...items.keys(), ...Object.keys(at)]));
  const merged: T[] = [];
  for (const key of keys) {
    let winner: (typeof sides)[number] | undefined;
    for (const side of sides) {
      if (!side.items.has(key) && !side.at[key]) continue;
      if (!winner || (side.at[key] ?? '') > (winner.at[key] ?? '')) winner = side;
    }
    const item = winner?.items.get(key);
    if (item !== undefined) merged.push(item);
  }
  return merged;
}

const laterDates = (a: Record<string, string> = {}, b: Record<string, string> = {}) => {
  const dates = { ...a };
  for (const [key, at] of Object.entries(b)) if (at > (dates[key] ?? '')) dates[key] = at;
  return dates;
};

/** Watched series, reminders and recent channels of one profile from both devices, with their dates. */
export function mergeDatedLists(
  phone: ProfilePrefs,
  local: ProfilePrefs,
  now: number,
  mergeReminders: (merged: Reminder[]) => Reminder[],
): Pick<ProfilePrefs, DatedList | 'listChangedAt'> {
  const result: Pick<ProfilePrefs, DatedList | 'listChangedAt'> = {};
  const phoneAt = phone.listChangedAt ?? {};
  const localAt = local.listChangedAt ?? {};
  if (phone.watchedSeries || local.watchedSeries)
    result.watchedSeries = mergeDated(
      phone.watchedSeries ?? [],
      local.watchedSeries ?? [],
      phoneAt.watchedSeries ?? {},
      localAt.watchedSeries ?? {},
      (id) => id,
    );
  if (phone.reminders || local.reminders)
    result.reminders = mergeReminders(
      mergeDated(phone.reminders ?? [], local.reminders ?? [], phoneAt.reminders ?? {}, localAt.reminders ?? {}, reminderKey),
    );
  if (phone.recentChannels || local.recentChannels) {
    const dates = laterDates(phoneAt.recentChannels, localAt.recentChannels);
    const phoneChannels = phone.recentChannels ?? [];
    const localChannels = local.recentChannels ?? [];
    // The copy of the side that watched it later (its name or picture may be newer); phone first when undated.
    const channels: RecentChannel[] = [...phoneChannels, ...localChannels.filter((c) => !phoneChannels.some((p) => p.id === c.id))].map(
      (channel) => {
        const theirs = localChannels.find((c) => c.id === channel.id);
        return theirs && (localAt.recentChannels?.[channel.id] ?? '') > (phoneAt.recentChannels?.[channel.id] ?? '') ? theirs : channel;
      },
    );
    // Newest first; undated ones after the dated, in the order above (the sort is stable).
    result.recentChannels = channels
      .sort((a, b) => ((dates[b.id] ?? '') > (dates[a.id] ?? '') ? 1 : (dates[b.id] ?? '') < (dates[a.id] ?? '') ? -1 : 0))
      .slice(0, MAX_RECENT_CHANNELS);
  }
  if (phone.listChangedAt || local.listChangedAt) {
    const dates: ListDates = {};
    for (const list of DATED_LISTS) {
      const joined = laterDates(phoneAt[list], localAt[list]);
      const pruned = pruneDates(list, joined, keysOf(list, result), now);
      if (Object.keys(pruned).length) dates[list] = pruned;
    }
    result.listChangedAt = dates;
  }
  return result;
}
