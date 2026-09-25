import type { SessionStore } from './sessionStore';
import type { KeyValueStorage } from './storage';

export const DOWNLOADS_OWNER_KEY = 'downloads.owner';

/**
 * Downloads belong to the account that made them (D-050): `signOut()` removes them before signing out, and a
 * login as a different account removes the previous account's downloads. Returns the unsubscribe too.
 */
export function bindDownloadsToAccount({
  session,
  storage,
  removeAll,
}: {
  session: SessionStore;
  storage: KeyValueStorage;
  removeAll(): Promise<void>;
}) {
  // Storage may be sync or async; failures must not block sign-in or sign-out.
  const safely = async <T>(action: () => T | Promise<T>): Promise<T | null> => {
    try {
      return await action();
    } catch {
      return null;
    }
  };
  let checking = Promise.resolve();
  const check = (accountId: string) => {
    checking = checking.then(async () => {
      const owner = await safely(() => storage.getItem(DOWNLOADS_OWNER_KEY));
      if (owner === accountId) return;
      if (owner) await safely(removeAll);
      await safely(() => storage.setItem(DOWNLOADS_OWNER_KEY, accountId));
    });
    return checking;
  };
  const current = session.getState().account?.id;
  if (current) void check(current);
  const unsubscribe = session.subscribe((state, previous) => {
    const id = state.account?.id;
    if (id && id !== previous.account?.id) void check(id);
  });

  return {
    unsubscribe,
    /** Waits for any pending owner check (tests). */
    settled: () => checking,
    async signOut() {
      await safely(removeAll);
      await safely(() => storage.removeItem(DOWNLOADS_OWNER_KEY));
      await session.getState().logout();
    },
  };
}
