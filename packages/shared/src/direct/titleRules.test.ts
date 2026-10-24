import { describe, expect, it } from 'vitest';
import { liveRules, mergeTitleRules, readTitleRules, recordRules, type RecordedRule } from './titleRules';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 24, 12, minute));
const merge = (src: string, dst: string, minute: number, removed?: boolean): RecordedRule => ({
  kind: 'movie',
  rule: 'merge',
  src,
  dst,
  at: at(minute).toISOString(),
  ...(removed ? { removed } : {}),
});

describe('title rules record (issue #267)', () => {
  it('dates new and changed rules, and marks the ones gone as removed', () => {
    let record = recordRules([], 'movie', [{ rule: 'merge', src: 'kA|', dst: 'kB|' }], at(0));
    record = recordRules(record, 'series', [{ rule: 'split', src: '7', dst: '' }], at(1));
    expect(record).toEqual([merge('kA|', 'kB|', 0), { kind: 'series', rule: 'split', src: '7', dst: '', at: at(1).toISOString() }]);
    // The same rules again: nothing moves.
    expect(recordRules(record, 'movie', [{ rule: 'merge', src: 'kA|', dst: 'kB|' }], at(5))).toEqual(record);
    // Undone: kept as removed, the series rule untouched.
    expect(recordRules(record, 'movie', [], at(6))[0]).toEqual(merge('kA|', 'kB|', 6, true));
  });

  it('two devices: per rule, the later change wins, removals included', () => {
    const phone = [merge('kA|', 'kB|', 0), merge('kC|', 'kD|', 10, true)];
    const tv = [merge('kA|', 'kB|', 5, true), merge('kC|', 'kD|', 2)];
    expect(mergeTitleRules(phone, tv, at(20))).toEqual([merge('kA|', 'kB|', 5, true), merge('kC|', 'kD|', 10, true)]);
    expect(liveRules(mergeTitleRules(phone, tv, at(20)), 'movie')).toEqual([]);
  });

  it('removals older than half a year are forgotten', () => {
    const old = merge('kA|', 'kB|', 0, true);
    expect(mergeTitleRules([old], [], new Date(at(0).getTime() + 200 * 24 * 3600_000))).toEqual([]);
  });

  it('merges from both devices never chain or loop, as on one device (D-185)', () => {
    // Phone: A into B; TV later: B into C. A follows B into C.
    expect(liveRules([merge('kA|', 'kB|', 0), merge('kB|', 'kC|', 1)], 'movie')).toEqual([
      { rule: 'merge', src: 'kA|', dst: 'kC|' },
      { rule: 'merge', src: 'kB|', dst: 'kC|' },
    ]);
    // A merge into a title merged elsewhere goes where that one went.
    expect(liveRules([merge('kB|', 'kC|', 0), merge('kA|', 'kB|', 1)], 'movie')).toEqual([
      { rule: 'merge', src: 'kA|', dst: 'kC|' },
      { rule: 'merge', src: 'kB|', dst: 'kC|' },
    ]);
    // A into B on one device, B into A on the other: the later one would loop and is left out.
    expect(liveRules([merge('kA|', 'kB|', 0), merge('kB|', 'kA|', 1)], 'movie')).toEqual([{ rule: 'merge', src: 'kA|', dst: 'kB|' }]);
  });

  it('reads only well-formed rules', () => {
    expect(readTitleRules(null)).toEqual([]);
    expect(readTitleRules('{"no":"list"}')).toEqual([]);
    expect(readTitleRules(JSON.stringify([merge('kA|', 'kB|', 0), { kind: 'live', rule: 'merge', src: 'x', dst: 'y', at: '' }]))).toEqual([
      merge('kA|', 'kB|', 0),
    ]);
  });
});
