import { useEffect } from 'react';
import { t } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { useDueReminder } from '../../hooks/stores';

/**
 * A guide reminder whose programme has started (issue #239, DECISIONS.md#d-184): at the top right of any page, over the
 * player too, with Watch and Dismiss. With the window in the background, the system shows a notification as well.
 */
export function ReminderToast() {
  const { reminder, dismiss, target } = useDueReminder();
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

  if (!reminder || !target) return null;
  return (
    <div className="banner banner--reminder" role="alertdialog" aria-label={t('Reminder')} data-testid="reminder">
      <strong>{t('Starting now: {title}', { title: reminder.title })}</strong>
      <span className="muted">{reminder.channel.name}</span>
      <div className="banner__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            dismiss();
            uiStore.getState().play(target);
          }}
        >
          {t('Watch')}
        </button>
        <button type="button" className="button button--ghost" onClick={dismiss}>
          {t('Dismiss')}
        </button>
      </div>
    </div>
  );
}
