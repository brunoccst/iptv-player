import { describe, expect, it } from 'vitest';
import { offlineAccess, OFFLINE_RECHECK_DAYS } from './offlineAccess';

const now = new Date('2026-09-25T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 3600_000).toISOString();

describe('offlineAccess', () => {
  it('allows downloads confirmed online recently and says when to recheck', () => {
    const access = offlineAccess({ expiresAt: '2027-01-01T00:00:00Z' }, daysAgo(2), now);
    expect(access).toEqual({ allowed: true, recheckBy: new Date(Date.parse(daysAgo(2)) + OFFLINE_RECHECK_DAYS * 24 * 3600_000) });
  });

  it('blocks after the recheck window', () => {
    expect(offlineAccess({ expiresAt: null }, daysAgo(OFFLINE_RECHECK_DAYS), now)).toMatchObject({
      allowed: false,
      reason: 'recheck-needed',
    });
  });

  it('blocks when the device clock was set back before the last online check', () => {
    expect(offlineAccess({ expiresAt: null }, daysAgo(-3), now)).toMatchObject({ allowed: false, reason: 'recheck-needed' });
  });

  it('blocks when the provider subscription has expired, even if online recently', () => {
    expect(offlineAccess({ expiresAt: daysAgo(1) }, daysAgo(0), now)).toMatchObject({ allowed: false, reason: 'subscription-expired' });
  });

  it('allows when nothing is known yet (session saved before this check existed)', () => {
    expect(offlineAccess({ expiresAt: null }, null, now)).toEqual({ allowed: true, recheckBy: null });
    expect(offlineAccess(null, null, now).allowed).toBe(true);
  });
});
