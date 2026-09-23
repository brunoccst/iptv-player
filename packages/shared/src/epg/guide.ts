import type { EpgListing } from '../api/types';

/** Guide column width. Matches the backend's default window alignment. */
export const EPG_SLOT_MINUTES = 30;
export const EPG_SLOT_MS = EPG_SLOT_MINUTES * 60_000;

/** One block in a guide row. `programme` null is a gap with no guide data. `left`/`width` are fractions of the window. */
export interface GuideCell {
  programme: EpgListing | null;
  startMs: number;
  endMs: number;
  left: number;
  width: number;
  /** True when the programme started before the window (draw a "continues" marker). */
  clippedStart: boolean;
}

export function floorToSlot(ms: number): number {
  return ms - (((ms % EPG_SLOT_MS) + EPG_SLOT_MS) % EPG_SLOT_MS);
}

/** Start time of every slot in [from, to). */
export function guideSlots(fromMs: number, toMs: number): number[] {
  const slots: number[] = [];
  for (let t = floorToSlot(fromMs); t < toMs; t += EPG_SLOT_MS) slots.push(t);
  return slots;
}

/**
 * Lays one channel's programmes over [from, to): sorted, clipped to the window, overlaps trimmed, gaps filled with
 * `programme: null` cells so every row spans the full width (TV focus needs something to land on).
 */
export function layoutGuideRow(programmes: readonly EpgListing[], fromMs: number, toMs: number): GuideCell[] {
  const span = toMs - fromMs;
  if (span <= 0) return [];
  const cell = (programme: EpgListing | null, startMs: number, endMs: number, clippedStart = false): GuideCell => ({
    programme,
    startMs,
    endMs,
    left: (startMs - fromMs) / span,
    width: (endMs - startMs) / span,
    clippedStart,
  });

  const sorted = programmes
    .map((programme) => ({ programme, start: Date.parse(programme.start), end: Date.parse(programme.end) }))
    .filter((p) => Number.isFinite(p.start) && Number.isFinite(p.end) && p.end > fromMs && p.start < toMs && p.end > p.start)
    .sort((a, b) => a.start - b.start);

  const cells: GuideCell[] = [];
  let cursor = fromMs;
  for (const { programme, start, end } of sorted) {
    const from = Math.max(start, cursor);
    const to = Math.min(end, toMs);
    if (to <= from) continue;
    if (from > cursor) cells.push(cell(null, cursor, from));
    cells.push(cell(programme, from, to, start < fromMs));
    cursor = to;
  }
  if (cursor < toMs) cells.push(cell(null, cursor, toMs));
  return cells;
}

/** Position of "now" in the window as a fraction, or null when outside it. */
export function nowFraction(nowMs: number, fromMs: number, toMs: number): number | null {
  return nowMs >= fromMs && nowMs < toMs ? (nowMs - fromMs) / (toMs - fromMs) : null;
}

export function programmeAt(programmes: readonly EpgListing[], ms: number): EpgListing | null {
  return programmes.find((p) => Date.parse(p.start) <= ms && ms < Date.parse(p.end)) ?? null;
}

/** 0..1 elapsed share of a programme at `nowMs`. */
export function programmeProgress(programme: EpgListing, nowMs: number): number {
  const start = Date.parse(programme.start);
  const end = Date.parse(programme.end);
  if (!(end > start)) return 0;
  return Math.min(1, Math.max(0, (nowMs - start) / (end - start)));
}

/** "14:30" style label in the viewer's locale and time zone. */
export function formatGuideTime(ms: number, locale?: string): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** "14:30 – 15:00". */
export function formatProgrammeTime(programme: EpgListing, locale?: string): string {
  return `${formatGuideTime(Date.parse(programme.start), locale)} – ${formatGuideTime(Date.parse(programme.end), locale)}`;
}
