import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { appLog, pruneReminders, t, type ProfileDto, type ProfilePrefs, type Reminder } from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { stores } from '../appContext';

/** One system alarm: the notification's words are ready, since the app may be closed when it goes off. */
export interface ReminderAlarm {
  id: string;
  startMs: number;
  title: string;
  text: string;
}

/**
 * Every profile's reminders on this phone as alarms (issue #263, DECISIONS.md#d-222), so the one who set it hears of it
 * even when another profile used the app last. The profile's name follows the channel when the account has several.
 */
export function reminderAlarms(profiles: readonly ProfileDto[], prefs: Record<string, ProfilePrefs>, now: number): ReminderAlarm[] {
  const byProgramme = new Map<string, { reminder: Reminder; names: string[] }>();
  for (const profile of profiles) {
    for (const reminder of pruneReminders(prefs[profile.id]?.reminders, now)) {
      if (!(Date.parse(reminder.start) > now)) continue;
      const id = `${reminder.channel.id}@${reminder.start}`;
      const entry = byProgramme.get(id) ?? { reminder, names: [] };
      entry.names.push(profile.name);
      byProgramme.set(id, entry);
    }
  }
  return [...byProgramme.entries()]
    .map(([id, { reminder, names }]) => ({
      id,
      startMs: Date.parse(reminder.start),
      title: t('Starting now: {title}', { title: reminder.title }),
      text: profiles.length > 1 ? `${reminder.channel.name} · ${names.join(', ')}` : reminder.channel.name,
    }))
    .sort((a, b) => a.startMs - b.startMs);
}

/** What the alarms should be now; null while the session or the preferences are still loading. */
function currentAlarms(): ReminderAlarm[] | null {
  const { status, profiles } = stores.session.getState();
  if (status === 'anonymous') return [];
  const prefs = stores.profilePrefs.getState();
  if (status !== 'authenticated' || !prefs.loaded) return null;
  return reminderAlarms(profiles, prefs.prefs, Date.now());
}

let asked = false;

/**
 * Android 13+ shows no notification without the person's yes; asked once per run while there are reminders. Not on the
 * TV, where the alarm opens the app instead (issue #309, `useOpenOnReminderPrompt`).
 */
async function askForNotifications() {
  if (asked || Platform.isTV || Platform.OS !== 'android' || (Platform.Version as number) < 33) return;
  asked = true;
  try {
    const result = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) appLog.info('reminders', `notifications ${result}`);
  } catch (error) {
    appLog.warn('reminders', `permission request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Keeps the system alarms in line with the reminders: at the start, a phone or tablet notifies (issue #263), a TV opens
 * the app on its reminder popup (issue #309, DECISIONS.md#d-238).
 */
export function useReminderAlarms(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let last = '';
    const sync = () => {
      const alarms = currentAlarms();
      if (!alarms) return;
      const key = JSON.stringify(alarms);
      if (key === last) return;
      last = key;
      try {
        TvMedia.scheduleReminders(key, t('Guide reminders'));
      } catch (error) {
        appLog.warn('reminders', `alarms failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (alarms.length) void askForNotifications();
    };
    sync();
    const unsubscribeSession = stores.session.subscribe(sync);
    const unsubscribePrefs = stores.profilePrefs.subscribe(sync);
    return () => {
      unsubscribeSession();
      unsubscribePrefs();
    };
  }, [enabled]);
}

let promptedTv = false;

const canOpenOverOtherApps = () => {
  try {
    return TvMedia.canOpenOverOtherApps();
  } catch {
    return true; // No way to ask: nothing to ask for.
  }
};

/**
 * TV (issue #309, DECISIONS.md#d-238): Android lets a reminder open the app from the background only with "Display over
 * other apps". While there are reminders and it is off, this asks once per run whether to turn it on.
 */
export function useOpenOnReminderPrompt(enabled: boolean): { visible: boolean; allow(): void; later(): void } {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled || !Platform.isTV) return;
    const check = () => {
      if (promptedTv || !currentAlarms()?.length || canOpenOverOtherApps()) return;
      promptedTv = true;
      setVisible(true);
    };
    check();
    const unsubscribeSession = stores.session.subscribe(check);
    const unsubscribePrefs = stores.profilePrefs.subscribe(check);
    return () => {
      unsubscribeSession();
      unsubscribePrefs();
    };
  }, [enabled]);
  return {
    visible,
    allow: () => {
      setVisible(false);
      let opened = false;
      try {
        opened = TvMedia.openOverOtherAppsSettings();
      } catch {
        // Logged below.
      }
      if (!opened) appLog.warn('reminders', 'this TV has no "Display over other apps" screen');
    },
    later: () => setVisible(false),
  };
}

/** For tests: ask again. */
export function resetReminderAlarms() {
  asked = false;
  promptedTv = false;
}
