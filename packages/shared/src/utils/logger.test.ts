import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../stores/storage';
import { createLogger, redact } from './logger';

describe('redact', () => {
  it('masks Xtream credentials in queries and stream paths', () => {
    expect(redact('GET http://p.tv/player_api.php?username=bob&password=s3cret&action=get_vod_streams')).toBe(
      'GET http://***/player_api.php?username=***&password=***&action=get_vod_streams',
    );
    expect(redact('http://p.tv:8080/movie/bob/s3cret/101.mkv and /live/a/b/7.ts')).toBe(
      'http://***/movie/***/***/101.mkv and /live/***/***/7.ts',
    );
  });

  it('masks servers, keys, tokens, e-mail and IP addresses but keeps public services and the device itself (D-173)', () => {
    expect(redact('retrying on the stream server https://user:pw@cdn.example.net:2083/live/a/b/1.ts')).toBe(
      'retrying on the stream server https://***/live/***/***/1.ts',
    );
    expect(redact('HTTP 503 from portal.example.com:8080 after 12 ms')).toBe('HTTP 503 from *** after 12 ms');
    expect(redact('attempt 1 failed: failed to connect to 7164443.merovixx.cc (port 80) after 10000ms')).toBe(
      'attempt 1 failed: failed to connect to *** (port 80) after 10000ms',
    );
    expect(redact('java.lang.OutOfMemoryError at expo.modules.fetch.Response.bodyText, 55.mkv, player_api.php, api.themoviedb.org')).toBe(
      'java.lang.OutOfMemoryError at expo.modules.fetch.Response.bodyText, 55.mkv, player_api.php, api.themoviedb.org',
    );
    expect(redact('at expo.modules.fetch.Response.bodyText(Response.kt:89), index.android.bundle.js:1200')).toBe(
      'at expo.modules.fetch.Response.bodyText(Response.kt:89), index.android.bundle.js:1200',
    );
    expect(redact('pairing with 192.168.1.20, proxy on http://127.0.0.1:4100/x')).toBe(
      'pairing with ***, proxy on http://127.0.0.1:4100/x',
    );
    expect(redact('GET https://api.themoviedb.org/3/movie/1?api_key=abc123 and https://api.opensubtitles.com/api/v1/login')).toBe(
      'GET https://api.themoviedb.org/3/movie/1?api_key=*** and https://api.opensubtitles.com/api/v1/login',
    );
    expect(redact('Authorization: Bearer eyJabc.def, mail bob@example.com')).toBe('Authorization: Bearer ***, mail ***@***');
  });

  it('masks the given secrets wherever they appear, ignoring case, and not ones too short to be safe', () => {
    expect(redact('Could not connect to MyProvider.tv (bob123 / hunter2), id 42', ['myprovider.tv', 'bob123', 'hunter2', '42'])).toBe(
      'Could not connect to *** (*** / ***), id 42',
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

  it('hides registered values in new lines and in lines kept from before', () => {
    const log = createLogger({ now: clock });
    log.info('provider', 'old line about portal.tv for bob');
    log.hide('portal.tv', 'bob', null, ' ');
    log.info('provider', 'Could not connect to portal.tv');
    expect(log.entries().map((entry) => entry.message)).toEqual(['old line about *** for ***', 'Could not connect to ***']);
    expect(log.shareText().text).not.toMatch(/portal\.tv|bob/);
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

    // Lines saved by an older version with weaker masking come back masked.
    await storage.setItem(
      'diagnostics.log',
      JSON.stringify([{ at: clock().toISOString(), level: 'info', area: 'x', message: 'GET http://p.tv/a' }]),
    );
    const third = createLogger({ now: clock });
    await third.persist(storage);
    expect(third.entries()[0]!.message).toBe('GET http://***/a');
    vi.useRealTimers();
  });

  it('drops lines older than the age limit, at start-up and while logging', async () => {
    let time = new Date('2026-09-20T12:00:00Z');
    const now = () => time;
    const storage = createMemoryStorage();
    const first = createLogger({ now, maxAgeMs: 3 * 24 * 3600_000 });
    first.info('app', 'old');
    await storage.setItem('diagnostics.log', JSON.stringify(first.entries()));

    time = new Date('2026-09-22T12:00:00Z');
    first.info('app', 'recent');
    expect(first.entries().map((entry) => entry.message)).toEqual(['old', 'recent']);
    time = new Date('2026-09-24T12:00:01Z');
    first.info('app', 'now');
    expect(first.entries().map((entry) => entry.message)).toEqual(['recent', 'now']);

    const second = createLogger({ now, maxAgeMs: 3 * 24 * 3600_000 });
    await second.persist(storage);
    expect(second.entries().map((entry) => entry.message)).toEqual(['--- app started ---']);
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
