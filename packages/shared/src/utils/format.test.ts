import { describe, expect, it } from 'vitest';
import { formatBytes, formatClock, formatDuration } from './format';

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

  it('formatBytes', () => {
    expect(formatBytes(350e6)).toBe('350 MB');
    expect(formatBytes(1.44e9)).toBe('1.4 GB');
  });
});
