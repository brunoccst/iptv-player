// Shared with the desktop app (issue #237, DECISIONS.md#d-214).
import '../screenHost';
import { ReminderDialog as SharedReminderDialog } from '@iptv/screens';
import { navStore } from '../appContext';

/** Watch replaces the player when one is open, so Back goes to the page under it. */
export function ReminderDialog() {
  return (
    <SharedReminderDialog
      onWatch={(target) => {
        const nav = navStore.getState();
        if (nav.stack.at(-1)?.name === 'player') nav.replaceTop({ name: 'player', target });
        else nav.push({ name: 'player', target });
      }}
    />
  );
}
