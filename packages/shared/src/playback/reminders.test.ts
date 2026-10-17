import { describe, expect, it } from 'vitest';
import type { LiveChannel } from '../api/types';
import {
  canRemind,
  dueReminders,
  hasReminder,
  MAX_REMINDERS,
  mergeReminders,
  nextReminderIn,
  reminderOf,
  toggleReminder,
} from './reminders';

const channel: LiveChannel = { id: '9', name: 'Sport', categoryId: '1', number: 9, logoUrl: null, epgChannelId: null, hasCatchup: false };
const at = (iso: string) => Date.parse(iso);
const show = (start: string, end: string, title = 'Final') => ({ title, description: null, start, end });
const match = reminderOf(channel, show('2026-10-17T20:00:00.000Z', '2026-10-17T22:00:00.000Z'));

describe('guide reminders (issue #239)', () => {
  it('sets and clears a reminder for a programme that has not started', () => {
    const now = at('2026-10-17T12:00:00Z');
    expect(canRemind(show('2026-10-17T20:00:00.000Z', '2026-10-17T22:00:00.000Z'), now)).toBe(true);
    expect(canRemind(show('2026-10-17T11:00:00.000Z', '2026-10-17T13:00:00.000Z'), now)).toBe(false);

    const set = toggleReminder([], match, now);
    expect(hasReminder(set, '9', match.start)).toBe(true);
    expect(toggleReminder(set, match, now)).toEqual([]);
  });

  it('is due from its start for ten minutes, and says when the next one starts', () => {
    expect(dueReminders([match], at('2026-10-17T19:59:00Z'))).toEqual([]);
    expect(dueReminders([match], at('2026-10-17T20:05:00Z'))).toEqual([match]);
    expect(dueReminders([match], at('2026-10-17T20:11:00Z'))).toEqual([]);
    expect(nextReminderIn([match], at('2026-10-17T19:59:00Z'))).toBe(60_000);
    expect(nextReminderIn([match], at('2026-10-17T20:01:00Z'))).toBeNull();
  });

  it('drops ended programmes, keeps the soonest first and at most the newest 50', () => {
    const ended = reminderOf(channel, show('2026-10-16T20:00:00.000Z', '2026-10-16T22:00:00.000Z'));
    const early = reminderOf(channel, show('2026-10-17T18:00:00.000Z', '2026-10-17T19:00:00.000Z', 'News'));
    const list = toggleReminder([ended, match], early, at('2026-10-17T12:00:00Z'));
    expect(list.map((r) => r.title)).toEqual(['News', 'Final']);

    const many = Array.from({ length: MAX_REMINDERS + 5 }, (_, i) =>
      reminderOf({ ...channel, id: String(i) }, show('2026-10-18T10:00:00.000Z', '2026-10-18T11:00:00.000Z')),
    );
    expect(many.reduce((acc, r) => toggleReminder(acc, r, at('2026-10-17T12:00:00Z')), [] as typeof many)).toHaveLength(MAX_REMINDERS);
  });

  it('joins both devices’ reminders on pairing, each programme once', () => {
    const other = reminderOf({ ...channel, id: '4' }, show('2026-10-17T21:00:00.000Z', '2026-10-17T22:00:00.000Z'));
    expect(mergeReminders([match], [match, other], at('2026-10-17T12:00:00Z'))).toEqual([match, other]);
  });
});
