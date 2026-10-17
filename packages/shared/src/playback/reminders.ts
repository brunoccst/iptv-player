import type { EpgListing, LiveChannel } from '../api/types';
import type { RecentChannel } from './recentChannels';

/**
 * A guide programme the profile asked to be reminded of (issue #239, DECISIONS.md#d-184): enough to say what starts and
 * to tune to its channel.
 */
export interface Reminder {
  channel: RecentChannel;
  title: string;
  /** ISO times of the programme. */
  start: string;
  end: string;
}

/** How many reminders a profile keeps; the oldest go first. */
export const MAX_REMINDERS = 50;
/** A reminder still shows this long after its programme started (the app was closed or busy at that moment). */
export const REMINDER_GRACE_MS = 10 * 60_000;

const sameProgramme = (a: Pick<Reminder, 'channel' | 'start'>, b: Pick<Reminder, 'channel' | 'start'>) =>
  a.channel.id === b.channel.id && a.start === b.start;

export const reminderOf = (channel: LiveChannel, programme: EpgListing): Reminder => ({
  channel: { id: channel.id, name: channel.name, logoUrl: channel.logoUrl, categoryId: channel.categoryId },
  title: programme.title,
  start: programme.start,
  end: programme.end,
});

/** Only programmes that have not started can get a reminder. */
export const canRemind = (programme: EpgListing | null, now: number): programme is EpgListing =>
  !!programme && Date.parse(programme.start) > now;

export const hasReminder = (list: readonly Reminder[] | null | undefined, channelId: string, start: string): boolean =>
  (list ?? []).some((reminder) => reminder.channel.id === channelId && reminder.start === start);

/** Adds the reminder, or takes it off when it is set; drops reminders whose programme is over. Sorted by start. */
export function toggleReminder(list: readonly Reminder[] | null | undefined, reminder: Reminder, now: number): Reminder[] {
  const current = pruneReminders(list, now);
  const without = current.filter((r) => !sameProgramme(r, reminder));
  if (without.length !== current.length) return without;
  return [...without, reminder].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(-MAX_REMINDERS);
}

/** Without the reminders whose programme has ended. */
export const pruneReminders = (list: readonly Reminder[] | null | undefined, now: number): Reminder[] =>
  (list ?? []).filter((reminder) => Date.parse(reminder.end) > now);

/** The reminders to show now: started at most `REMINDER_GRACE_MS` ago, soonest first. */
export const dueReminders = (list: readonly Reminder[] | null | undefined, now: number): Reminder[] =>
  (list ?? []).filter((reminder) => {
    const start = Date.parse(reminder.start);
    return start <= now && now - start <= REMINDER_GRACE_MS && Date.parse(reminder.end) > now;
  });

/** Milliseconds until the next reminder is due; null when none is waiting. */
export function nextReminderIn(list: readonly Reminder[] | null | undefined, now: number): number | null {
  const starts = (list ?? []).map((reminder) => Date.parse(reminder.start)).filter((start) => start > now);
  return starts.length ? Math.min(...starts) - now : null;
}

/** Both devices' reminders after pairing (D-060): every programme once, without ended ones. */
export function mergeReminders(
  a: readonly Reminder[] | null | undefined,
  b: readonly Reminder[] | null | undefined,
  now: number,
): Reminder[] {
  const merged = [...pruneReminders(a, now)];
  for (const reminder of pruneReminders(b, now)) if (!merged.some((r) => sameProgramme(r, reminder))) merged.push(reminder);
  return merged.sort((x, y) => Date.parse(x.start) - Date.parse(y.start)).slice(-MAX_REMINDERS);
}
