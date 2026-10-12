import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OWN_STREAM_GRACE_MS,
  checkConnectionLimit,
  connectionCheckNeeded,
  holdStreamConnection,
  resetConnectionLimit,
  spareConnection,
} from './connectionLimit';

describe('connection limit (issue #242)', () => {
  afterEach(() => {
    resetConnectionLimit();
    vi.useRealTimers();
  });

  it('warns only when the account is full', async () => {
    expect(await checkConnectionLimit(async () => ({ active: 1, max: 1 }))).toEqual({ active: 1, max: 1 });
    expect(await checkConnectionLimit(async () => ({ active: 1, max: 2 }))).toBeNull();
    expect(await checkConnectionLimit(async () => ({ active: null, max: 1 }))).toBeNull();
    expect(await checkConnectionLimit(async () => ({ active: 3, max: 0 }))).toBeNull();
    expect(await checkConnectionLimit(() => Promise.reject(new Error('offline')))).toBeNull();
  });

  it('never waits longer than the timeout', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const result = checkConnectionLimit(
      (signal) =>
        new Promise(() => {
          signal.addEventListener('abort', () => (aborted = true));
        }),
      3000,
    );
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBeNull();
    expect(aborted).toBe(true);
  });

  it('skips the check while the app streams and just after, since the provider still counts that stream', () => {
    let now = 1_000_000;
    expect(connectionCheckNeeded(now)).toBe(true);
    const release = holdStreamConnection(() => now);
    expect(connectionCheckNeeded(now)).toBe(false);
    now += 5000;
    release();
    release();
    expect(connectionCheckNeeded(now + OWN_STREAM_GRACE_MS - 1)).toBe(false);
    expect(connectionCheckNeeded(now + OWN_STREAM_GRACE_MS)).toBe(true);
  });

  it('allows a preview connection only when one is spare (issue #218)', async () => {
    expect(spareConnection(null)).toBe(true);
    expect(spareConnection(1)).toBe(false);
    expect(spareConnection(2)).toBe(true);
    await checkConnectionLimit(async () => ({ active: 1, max: 2 }));
    expect(spareConnection(2)).toBe(false);
    await checkConnectionLimit(async () => ({ active: 0, max: 2 }));
    expect(spareConnection(2)).toBe(true);
  });
});
