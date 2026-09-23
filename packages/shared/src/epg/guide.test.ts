import { describe, expect, it } from 'vitest';
import type { EpgListing } from '../api/types';
import { floorToSlot, guideSlots, layoutGuideRow, nowFraction, programmeAt, programmeProgress } from './guide';

const T0 = Date.parse('2026-09-23T12:00:00Z');
const min = (m: number) => T0 + m * 60_000;
const show = (title: string, startMin: number, endMin: number): EpgListing => ({
  title,
  description: null,
  start: new Date(min(startMin)).toISOString(),
  end: new Date(min(endMin)).toISOString(),
});

describe('guide layout', () => {
  it('aligns to half-hour slots', () => {
    expect(floorToSlot(min(47))).toBe(min(30));
    expect(floorToSlot(min(30))).toBe(min(30));
    expect(guideSlots(min(10), min(120))).toEqual([min(0), min(30), min(60), min(90)]);
  });

  it('clips to the window, fills gaps and trims overlaps', () => {
    const cells = layoutGuideRow(
      [show('Late', 90, 150), show('Early', -30, 30), show('Overlap', 20, 60), show('Outside', 200, 230)],
      min(0),
      min(120),
    );

    expect(cells.map((c) => [c.programme?.title ?? null, (c.startMs - T0) / 60_000, (c.endMs - T0) / 60_000])).toEqual([
      ['Early', 0, 30],
      ['Overlap', 30, 60],
      [null, 60, 90],
      ['Late', 90, 120],
    ]);
    expect(cells[0]).toMatchObject({ left: 0, width: 0.25, clippedStart: true });
    expect(cells[3]).toMatchObject({ left: 0.75, width: 0.25, clippedStart: false });
    expect(cells.reduce((sum, c) => sum + c.width, 0)).toBeCloseTo(1);
  });

  it('gives an empty row one full-width gap cell', () => {
    expect(layoutGuideRow([], min(0), min(60))).toEqual([
      { programme: null, startMs: min(0), endMs: min(60), left: 0, width: 1, clippedStart: false },
    ]);
  });

  it('finds the current programme, its progress and the now line', () => {
    const shows = [show('A', 0, 30), show('B', 30, 90)];
    expect(programmeAt(shows, min(45))?.title).toBe('B');
    expect(programmeAt(shows, min(90))).toBeNull();
    expect(programmeProgress(shows[1]!, min(60))).toBeCloseTo(0.5);
    expect(nowFraction(min(30), min(0), min(120))).toBe(0.25);
    expect(nowFraction(min(130), min(0), min(120))).toBeNull();
  });
});
