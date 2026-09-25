import type { AccountDto } from '../api/types';

/** Downloads play offline for this long after the app last reached the provider (or server). See DECISIONS.md#d-050. */
export const OFFLINE_RECHECK_DAYS = 30;
const DAY_MS = 24 * 3600_000;

export type OfflineAccess =
  | { allowed: true; /** When the next online check is due. */ recheckBy: Date | null }
  | { allowed: false; reason: 'subscription-expired' | 'recheck-needed'; message: string };

/**
 * Whether downloaded titles may play: the provider subscription must not have expired, and the account must have
 * been confirmed online within `OFFLINE_RECHECK_DAYS`. Enforced by the apps, not by the stored files (KI-002).
 */
export function offlineAccess(
  account: Pick<AccountDto, 'expiresAt'> | null,
  lastOnlineAt: string | null,
  now: Date = new Date(),
): OfflineAccess {
  const expires = account?.expiresAt ? Date.parse(account.expiresAt) : NaN;
  if (expires <= now.getTime())
    return {
      allowed: false,
      reason: 'subscription-expired',
      message: 'Your IPTV subscription has expired. Downloads play again once it is renewed and the app is online.',
    };
  const confirmed = lastOnlineAt ? Date.parse(lastOnlineAt) : NaN;
  if (Number.isNaN(confirmed)) return { allowed: true, recheckBy: null };
  const recheckBy = new Date(confirmed + OFFLINE_RECHECK_DAYS * DAY_MS);
  // A clock set back before the last check would otherwise extend the window forever.
  if (recheckBy.getTime() <= now.getTime() || now.getTime() < confirmed - DAY_MS)
    return {
      allowed: false,
      reason: 'recheck-needed',
      message: `Connect to the internet to keep watching downloads (needed every ${OFFLINE_RECHECK_DAYS} days).`,
    };
  return { allowed: true, recheckBy };
}

/** "25 Oct 2026" in German time (the app's users are in Germany). */
export const formatOfflineDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin' });
