import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_THRESHOLD_MS, RemoteSeekController, SCRUB_DOUBLING_MS, SCRUB_MAX_SPEED, scrubSpeed } from './remoteSeek';

function setup(time = 100, duration = 1000) {
  const events: string[] = [];
  const state = { time };
  const controller = new RemoteSeekController({
    getTime: () => state.time,
    getDuration: () => duration,
    onTap: (direction, target) => events.push(`tap:${direction}:${target}`),
    onScrub: (preview, speed) => events.push(`scrub:${Math.round(preview)}:${speed}`),
    onScrubEnd: (final) => events.push(`end:${Math.round(final)}`),
  });
  return { controller, events, state };
}

describe('RemoteSeekController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a short press skips 10 s once, ignoring auto-repeat key-downs', () => {
    const { controller, events } = setup();

    controller.keyDown('forward');
    vi.advanceTimersByTime(100);
    controller.keyDown('forward');
    controller.keyUp('forward');

    expect(events).toEqual(['tap:forward:110']);
  });

  it('taps clamp to the start and end of the media', () => {
    const { controller, events, state } = setup(5, 100);
    controller.keyDown('back');
    controller.keyUp('back');
    state.time = 95;
    controller.keyDown('forward');
    controller.keyUp('forward');

    expect(events).toEqual(['tap:back:0', 'tap:forward:100']);
  });

  it('holding scrubs with increasing speed and seeks once on release', () => {
    const { controller, events } = setup(100, 10_000);

    controller.keyDown('forward');
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
    expect(controller.isScrubbing).toBe(true);
    vi.advanceTimersByTime(SCRUB_DOUBLING_MS * 2);
    controller.keyUp('forward');

    const speeds = events.filter((e) => e.startsWith('scrub')).map((e) => Number(e.split(':')[2]));
    expect(speeds[0]).toBe(10);
    expect(speeds.at(-1)).toBe(40);
    expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
    expect(events.filter((e) => e.startsWith('tap'))).toEqual([]);
    const final = Number(events.at(-1)!.split(':')[1]);
    expect(events.at(-1)).toMatch(/^end:/);
    expect(final).toBeGreaterThan(130);
    expect(controller.isScrubbing).toBe(false);
  });

  it('scrubbing backwards stops at zero', () => {
    const { controller, events } = setup(3);
    controller.keyDown('back');
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 2000);
    controller.keyUp('back');

    expect(events.at(-1)).toBe('end:0');
  });

  it('switching direction mid-press finishes the first press', () => {
    const { controller, events } = setup();
    controller.keyDown('forward');
    controller.keyDown('back');
    controller.keyUp('back');

    expect(events).toEqual(['tap:forward:110', 'tap:back:90']);
  });

  it('cancel drops the press without seeking; stray key-ups are ignored', () => {
    const { controller, events } = setup();
    controller.keyUp('forward');
    controller.keyDown('forward');
    vi.advanceTimersByTime(HOLD_THRESHOLD_MS + 500);
    controller.cancel();
    controller.keyUp('forward');

    expect(events.every((e) => e.startsWith('scrub'))).toBe(true);
    expect(controller.isScrubbing).toBe(false);
  });

  it('speed curve doubles and caps', () => {
    expect(scrubSpeed(0)).toBe(10);
    expect(scrubSpeed(SCRUB_DOUBLING_MS)).toBe(20);
    expect(scrubSpeed(SCRUB_DOUBLING_MS * 100)).toBe(SCRUB_MAX_SPEED);
  });
});
