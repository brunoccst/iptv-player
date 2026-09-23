import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from './format';

describe('format', () => {
  it('formatDuration', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(2700)).toBe('45m');
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(-1)).toBe('');
  });

  it('formatClock', () => {
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(125.9)).toBe('2:05');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});
