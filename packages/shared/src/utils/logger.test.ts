import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../stores/storage';
import { createLogger, redact } from './logger';

describe('redact', () => {
  it('masks Xtream credentials in queries and stream paths', () => {
    expect(redact('GET http://p.tv/player_api.php?username=bob&password=s3cret&action=get_vod_streams')).toBe(
      'GET http://p.tv/player_api.php?username=***&password=***&action=get_vod_streams',
    );
    expect(redact('http://p.tv:8080/movie/bob/s3cret/101.mkv and /live/a/b/7.ts')).toBe(
      'http://p.tv:8080/movie/***/***/101.mkv and /live/***/***/7.ts',
    );
  });
});

describe('createLogger', () => {
  const clock = () => new Date('2026-09-24T12:00:00Z');

  it('keeps the newest entries, masked, as shareable text', () => {
    const log = createLogger({ limit: 2, now: clock });
    log.info('a', 'one');
    log.warn('b', 'two password=x');
    log.error('c', 'three');
    expect(log.entries().map((entry) => entry.message)).toEqual(['two password=***', 'three']);
    expect(log.text()).toBe('2026-09-24T12:00:00.000Z WARN  [b] two password=***\n2026-09-24T12:00:00.000Z ERROR [c] three');
    log.clear();
    expect(log.entries()).toEqual([]);
  });

  it('restores the previous session and saves new lines', async () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const first = createLogger({ now: clock });
    await first.persist(storage);
    first.info('library', 'saved');
    vi.advanceTimersByTime(2500);

    const second = createLogger({ now: clock });
    second.info('app', 'booting');
    await second.persist(storage);
    expect(second.entries().map((entry) => entry.message)).toEqual(['saved', '--- app started ---', 'booting']);
    vi.useRealTimers();
  });

  it('shares the newest lines within a size limit and folds repeats (share targets cut long texts)', () => {
    const log = createLogger({ limit: 1000 });
    for (let i = 0; i < 50; i++) log.info('provider', `get_short_epg: HTTP 200, 19 chars in ${100 + i} ms`);
    for (let i = 0; i < 200; i++) log.info('player', `attempt ${i}: failed with a fairly long message to fill the budget`);
    log.error('player', 'newest line');

    const small = log.shareText(2000);
    expect(small.text.endsWith('newest line')).toBe(true);
    expect(small.text.length).toBeLessThanOrEqual(2000);
    expect(small.omitted).toBeGreaterThan(0);

    const all = log.shareText(1_000_000);
    expect(all.omitted).toBe(0);
    expect(all.text).toContain('get_short_epg: HTTP 200, 19 chars in 100 ms (×50 until the next line)');
    expect(all.lines).toBe(1 + 200 + 1);
  });
});
