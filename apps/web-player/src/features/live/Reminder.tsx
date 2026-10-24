import { useEffect } from 'react';
import { ReminderDialog } from '@iptv/screens';
import { t } from '@iptv/shared';
import '../browse/screenHost';
import { uiStore } from '../../appContext';
import { useDueReminder } from '../../hooks/stores';

/**
 * A guide reminder whose programme has started (issue #239, DECISIONS.md#d-184): the TV's dialog over any page, over the
 * player too (DECISIONS.md#d-214). With the window in the background, the system shows a notification as well.
 */
export function Reminder() {
  const { reminder } = useDueReminder();
  const key = reminder ? `${reminder.channel.id}@${reminder.start}` : null;

  useEffect(() => {
    if (!reminder || typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    const notification = new Notification(t('Starting now: {title}', { title: reminder.title }), {
      body: reminder.channel.name,
      tag: key!,
    });
    notification.onclick = () => window.focus();
    return () => notification.close();
    // One notification per reminder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <ReminderDialog onWatch={(target) => uiStore.getState().play(target)} />;
}
