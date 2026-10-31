import { Platform } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import type { Reminder } from '@iptv/shared';
import { stores } from '../appContext';
import { nativeState } from '../../test/tvMediaMock';
import { profile, setupApp } from '../../test/utils';
import { reminderAlarms, resetReminderAlarms, useOpenOnReminderPrompt, useReminderAlarms } from './reminderAlarms';

const now = Date.parse('2026-10-24T12:00:00Z');
const reminder = (start: string, title = 'The Match', channelId = 'c1'): Reminder => ({
  channel: { id: channelId, name: 'Sport 1', logoUrl: null, categoryId: 'sports' },
  title,
  start,
  end: new Date(Date.parse(start) + 2 * 3600_000).toISOString(),
});
const kid = { id: 'p2', name: 'Sam', avatarKey: null, isKids: true };

describe('reminderAlarms (issue #263)', () => {
  it('turns the reminders that have not started into alarms, soonest first', () => {
    const later = reminder('2026-10-24T20:00:00.000Z', 'Late show', 'c2');
    const soon = reminder('2026-10-24T18:00:00.000Z');
    const started = reminder('2026-10-24T11:30:00.000Z', 'On now');
    expect(reminderAlarms([profile], { p1: { reminders: [later, started, soon] } }, now)).toEqual([
      { id: 'c1@2026-10-24T18:00:00.000Z', startMs: Date.parse(soon.start), title: 'Starting now: The Match', text: 'Sport 1' },
      { id: 'c2@2026-10-24T20:00:00.000Z', startMs: Date.parse(later.start), title: 'Starting now: Late show', text: 'Sport 1' },
    ]);
  });

  it("covers every profile's reminders, naming who set each when the account has several", () => {
    const match = reminder('2026-10-24T18:00:00.000Z');
    const cartoon = reminder('2026-10-24T16:00:00.000Z', 'Cartoons', 'c9');
    const alarms = reminderAlarms([profile, kid], { p1: { reminders: [match] }, p2: { reminders: [match, cartoon] } }, now);
    expect(alarms.map((a) => [a.title, a.text])).toEqual([
      ['Starting now: Cartoons', 'Sport 1 · Sam'],
      ['Starting now: The Match', 'Sport 1 · Alex, Sam'],
    ]);
  });

  it('leaves out profiles of other accounts', () => {
    expect(reminderAlarms([profile], { other: { reminders: [reminder('2026-10-24T18:00:00.000Z')] } }, now)).toEqual([]);
  });
});

describe('useReminderAlarms', () => {
  it('hands the alarms over when reminders change, and clears them on sign-out', async () => {
    setupApp();
    const future = new Date(Date.now() + 3600_000).toISOString();
    stores.profilePrefs.setState({ prefs: {}, loaded: true });
    await renderHook(() => useReminderAlarms(true));
    expect(nativeState.reminderAlarms).toEqual([]);

    await act(async () => stores.profilePrefs.getState().update('p1', { reminders: [reminder(future)] }));
    expect(nativeState.reminderAlarms.map((a) => a.title)).toEqual(['Starting now: The Match']);

    await act(async () =>
      stores.session.setState({ status: 'anonymous', token: null, account: null, profiles: [], activeProfileId: null }),
    );
    expect(nativeState.reminderAlarms).toEqual([]);
  });
});

describe('useOpenOnReminderPrompt (issue #309)', () => {
  const tv = (isTV: boolean) => Object.defineProperty(Platform, 'isTV', { value: isTV, configurable: true });
  afterEach(() => {
    tv(false);
    resetReminderAlarms();
  });

  it('on a TV with reminders, asks once to allow opening over other apps, and opens its settings', async () => {
    tv(true);
    setupApp();
    nativeState.overOtherApps = false;
    stores.profilePrefs.setState({ prefs: {}, loaded: true });
    const { result } = await renderHook(() => useOpenOnReminderPrompt(true));
    expect(result.current.visible).toBe(false);

    await act(async () =>
      stores.profilePrefs.getState().update('p1', { reminders: [reminder(new Date(Date.now() + 3600_000).toISOString())] }),
    );
    expect(result.current.visible).toBe(true);
    await act(async () => result.current.allow());
    expect(result.current.visible).toBe(false);
    expect(nativeState.calls).toContain('over-other-apps-settings');

    // Not again in this run.
    await act(async () =>
      stores.profilePrefs.getState().update('p1', { reminders: [reminder(new Date(Date.now() + 7200_000).toISOString(), 'Late')] }),
    );
    expect(result.current.visible).toBe(false);
  });

  it('asks nothing when it is allowed already, or on a phone', async () => {
    setupApp();
    stores.profilePrefs.setState({ prefs: { p1: { reminders: [reminder(new Date(Date.now() + 3600_000).toISOString())] } }, loaded: true });
    nativeState.overOtherApps = false;
    const phone = await renderHook(() => useOpenOnReminderPrompt(true));
    expect(phone.result.current.visible).toBe(false);
    tv(true);
    nativeState.overOtherApps = true;
    const allowed = await renderHook(() => useOpenOnReminderPrompt(true));
    expect(allowed.result.current.visible).toBe(false);
  });
});
