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
});
