import type { EpgListing, LiveChannel } from '../api/types';
import { formatProgrammeTime } from '../epg/guide';
import type { PlayTarget } from './targets';

/** A programme played from the provider's recordings instead of live (issue #226, DECISIONS.md#d-032). */
export interface CatchupWindow {
  /** ISO times of the programme. */
  start: string;
  end: string;
}

/**
 * How a guide programme can be watched: `past` from the recording (it has ended), `restart` from its start (it is on
 * now), or null (no recordings on this channel, it has not started, or it started before the provider's recordings
 * do, issue #247).
 */
export function catchupMode(
  channel: Pick<LiveChannel, 'hasCatchup' | 'catchupDays'>,
  programme: EpgListing | null,
  now: number,
): 'past' | 'restart' | null {
  if (!channel.hasCatchup || !programme) return null;
  const start = Date.parse(programme.start);
  const end = Date.parse(programme.end);
  if (!(start < end) || start > now) return null;
  if ((channel.catchupDays ?? 0) > 0 && start < now - channel.catchupDays! * 24 * 3600_000) return null;
  return end <= now ? 'past' : 'restart';
}

/** Plays `programme` of `channel` from the provider's recordings: a fixed-length video that can be paused and sought. */
export function catchupTarget(channel: LiveChannel, programme: EpgListing): PlayTarget {
  return {
    kind: 'live',
    streamId: channel.id,
    container: 'm3u8',
    title: programme.title,
    subtitle: `${channel.name} · ${formatProgrammeTime(programme)}`,
    posterUrl: channel.logoUrl,
    categoryId: channel.categoryId,
    catchup: { start: programme.start, end: programme.end },
  };
}

/** A live channel as it airs (not a recording): no seeking, no saved progress. */
export function isLiveStream(target: Pick<PlayTarget, 'kind' | 'catchup'>): boolean {
  return target.kind === 'live' && !target.catchup;
}

/**
 * Xtream's timeshift start, `YYYY-MM-DD:HH-MM` in the panel's time zone (`server_info.timezone`); UTC when the panel
 * names none or one this device does not know.
 */
export function timeshiftStart(iso: string, timeZone: string | null | undefined): string {
  const date = new Date(iso);
  let parts: Record<string, string> | null = null;
  if (timeZone && timeZone !== 'UTC') {
    try {
      const format = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      parts = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
    } catch {
      parts = null;
    }
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  const { year, month, day, hour, minute } = parts ?? {
    year: String(date.getUTCFullYear()),
    month: pad(date.getUTCMonth() + 1),
    day: pad(date.getUTCDate()),
    hour: pad(date.getUTCHours()),
    minute: pad(date.getUTCMinutes()),
  };
  // Some engines write midnight as 24 even with h23.
  return `${year}-${month}-${day}:${hour === '24' ? '00' : hour}-${minute}`;
}

/** The recording's length in whole minutes, as the timeshift address asks for it. */
export function timeshiftMinutes(window: CatchupWindow): number {
  return Math.max(1, Math.ceil((Date.parse(window.end) - Date.parse(window.start)) / 60_000));
}
