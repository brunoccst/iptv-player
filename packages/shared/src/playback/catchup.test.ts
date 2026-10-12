import { describe, expect, it } from 'vitest';
import type { LiveChannel } from '../api/types';
import { catchupMode, catchupTarget, isLiveStream, timeshiftMinutes, timeshiftStart } from './catchup';

const channel: LiveChannel = {
  id: '9',
  name: 'News',
  categoryId: '1',
  number: 1,
  logoUrl: 'logo.png',
  epgChannelId: 'news',
  hasCatchup: true,
};
const programme = { title: 'Evening news', description: null, start: '2026-10-12T18:00:00.000Z', end: '2026-10-12T18:30:00.000Z' };
const at = (iso: string) => Date.parse(iso);

describe('catch-up (issue #226)', () => {
  it('plays ended programmes from the recording and running ones from their start, on channels with recordings', () => {
    expect(catchupMode(channel, programme, at('2026-10-12T19:00:00Z'))).toBe('past');
    expect(catchupMode(channel, programme, at('2026-10-12T18:10:00Z'))).toBe('restart');
    expect(catchupMode(channel, programme, at('2026-10-12T17:00:00Z'))).toBeNull();
    expect(catchupMode({ hasCatchup: false }, programme, at('2026-10-12T19:00:00Z'))).toBeNull();
    expect(catchupMode(channel, null, at('2026-10-12T19:00:00Z'))).toBeNull();
  });

  it('makes a seekable target for the programme', () => {
    const target = catchupTarget(channel, programme);
    expect(target).toMatchObject({
      kind: 'live',
      streamId: '9',
      title: 'Evening news',
      catchup: { start: programme.start, end: programme.end },
    });
    expect(isLiveStream(target)).toBe(false);
    expect(isLiveStream({ kind: 'live' })).toBe(true);
    expect(isLiveStream({ kind: 'movie' })).toBe(false);
  });

  it("writes the start in the panel's time zone and the length in whole minutes", () => {
    expect(timeshiftStart('2026-01-05T23:30:00.000Z', 'America/New_York')).toBe('2026-01-05:18-30');
    expect(timeshiftStart('2026-01-05T23:30:00.000Z', 'Europe/Berlin')).toBe('2026-01-06:00-30');
    expect(timeshiftStart('2026-01-05T23:30:00.000Z', null)).toBe('2026-01-05:23-30');
    expect(timeshiftMinutes({ start: programme.start, end: '2026-10-12T18:29:10.000Z' })).toBe(30);
  });
});
