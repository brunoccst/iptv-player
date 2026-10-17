import type { BackupStorages } from '../backup/userData';
import { appLog, errorMessage } from '../utils/logger';
import { applySyncedMedia, mediaForSync } from './pairing';
import { RemoteFailure, sendRemoteCommand, type PairedTv, type RemoteCommand, type RemoteReply } from './remote';

/**
 * Automatic sync with the paired TV (issue #227, DECISIONS.md#d-186). After a device scanned the TV's code (D-060), it
 * keeps the TV's remote-play key (D-061). With it, the phone, tablet or desktop app sends its profiles, progress and
 * My List to the TV whenever it opens or comes back to the front, and every few minutes while it is open; the TV
 * merges them and answers with the merged lists. The TV is the hub: two phones paired with the same TV stay in step
 * through it.
 */
export const AUTO_SYNC_INTERVAL_MS = 10 * 60_000;
/** Opening the app twice within this time syncs once. */
const MIN_SYNC_GAP_MS = 60_000;

/**
 * One sync: sends this device's media entries to the TV and saves the merged answer. `changed`: this device's lists
 * changed (refresh the screens). Throws `RemoteFailure` (an unreachable TV is normal: it is off, or another network).
 */
export async function syncWithTv(
  storages: BackupStorages,
  tv: PairedTv,
  accountId: string,
  options: { fetch?: typeof fetch; timeoutMs?: number; now?: () => Date } = {},
): Promise<{ port: number; changed: boolean }> {
  const data = await mediaForSync(storages, accountId);
  const answer = await sendRemoteCommand(tv, { type: 'sync', accountId, data }, options);
  // An older TV app answers 'bad-request' to a sync, which throws above; no data here means the same.
  if (!answer.data) throw new RemoteFailure('bad-request', tv.tvName);
  const applied = await applySyncedMedia(storages, accountId, answer.data, options.now?.());
  return { port: answer.port, changed: applied?.changed ?? false };
}

/** TV side: answers a sync command from a paired device. `changed`: the TV's lists changed (refresh the screens). */
export async function answerSync(
  storages: BackupStorages,
  command: Extract<RemoteCommand, { type: 'sync' }>,
  now = new Date(),
): Promise<{ reply: RemoteReply; changed: boolean }> {
  if (!command.accountId || !command.data || typeof command.data !== 'object')
    return { reply: { ok: false, error: 'bad-request' }, changed: false };
  const applied = await applySyncedMedia(storages, command.accountId, command.data, now);
  if (!applied) return { reply: { ok: false, error: 'other-account' }, changed: false };
  return { reply: { ok: true, data: applied.data }, changed: applied.changed };
}

/**
 * Phone, tablet and desktop: runs `sync` when asked, at most once a minute and never twice at the same time. The app
 * asks on start, when it comes back to the front, and every `AUTO_SYNC_INTERVAL_MS`.
 */
export function createAutoSync(sync: () => Promise<void>, now: () => number = Date.now): { request(): Promise<void> } {
  let running: Promise<void> | null = null;
  let lastStarted = -Infinity;
  return {
    request() {
      if (running) return running;
      if (now() - lastStarted < MIN_SYNC_GAP_MS) return Promise.resolve();
      lastStarted = now();
      running = sync()
        .catch((error: unknown) => {
          // An unreachable TV (off, or another network) is expected; only a short note.
          if (error instanceof RemoteFailure && error.reason === 'unreachable') appLog.info('sync', 'TV not reachable');
          else appLog.warn('sync', errorMessage(error));
        })
        .finally(() => {
          running = null;
        });
      return running;
    },
  };
}
