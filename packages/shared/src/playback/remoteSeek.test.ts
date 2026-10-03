import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOLD_THRESHOLD_MS,
  RemoteSeekController,
  SCRUB_DOUBLING_MS,
  SCRUB_MAX_SPEED,
  TAP_CHAIN_MS,
  scrubSpeed,
  tapStep,
} from './remoteSeek';

function setup(time = 100, duration = 1000) {
  const events: string[] = [];
  const state = { time };
  const controller = new RemoteSeekController({
    getTime: () => state.time,
    getDuration: () => duration,
    // The player seeks: the time moves.
    onTap: (direction, target) => {
      events.push(`tap:${direction}:${target}`);
      state.time = target;
    },
    onScrub: (preview, speed, _direction, step) =>
      events.push(step ? `preview:${Math.round(preview)}:${step}` : `scrub:${Math.round(preview)}:${speed}`),
    onScrubEnd: (final) => {
      events.push(`end:${Math.round(final)}`);
      state.time = final;
    },
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
    vi.advanceTimersByTime(TAP_CHAIN_MS);
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
    vi.advanceTimersByTime(TAP_CHAIN_MS);

    // The second press, right after the first, is the next press of a series (issue #121).
    expect(events).toEqual(['tap:forward:110', 'preview:100:10', 'end:100']);
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

  describe('presses in a row go faster (issue #121)', () => {
    const press = (controller: RemoteSeekController, direction: 'back' | 'forward', times = 1) => {
      for (let i = 0; i < times; i++) {
        controller.keyDown(direction);
        controller.keyUp(direction);
        vi.advanceTimersByTime(TAP_CHAIN_MS / 2);
      }
    };

    it('the first press seeks 10 s at once; the next ones move a preview by growing steps, then the video jumps once', () => {
      const { controller, events } = setup(100, 10_000);
      press(controller, 'forward', 7);
      expect(events).toEqual([
        'tap:forward:110',
        'preview:120:10',
        'preview:150:30',
        'preview:180:30',
        'preview:240:60',
        'preview:300:60',
        'preview:420:120',
      ]);
      vi.advanceTimersByTime(TAP_CHAIN_MS);
      expect(events.at(-1)).toBe('end:420');
      expect([7, 8, 9, 20].map(tapStep)).toEqual([120, 120, 300, 300]);
    });

    it('a press the other way fine-tunes from the preview with the smallest step', () => {
      const { controller, events } = setup(100, 10_000);
      press(controller, 'forward', 4);
      press(controller, 'back');
      vi.advanceTimersByTime(TAP_CHAIN_MS);
      expect(events.slice(-2)).toEqual(['preview:170:10', 'end:170']);
    });

    it('a pause ends the series: the next press is a plain 10 s seek again', () => {
      const { controller, events } = setup(100, 10_000);
      press(controller, 'back');
      vi.advanceTimersByTime(TAP_CHAIN_MS);
      press(controller, 'back');
      expect(events).toEqual(['tap:back:90', 'tap:back:80']);
    });

    it('previews stop at the start and the end', () => {
      const { controller, events } = setup(9_900, 9_950);
      press(controller, 'forward', 3);
      press(controller, 'back', 1);
      expect(events).toEqual(['tap:forward:9910', 'preview:9920:10', 'preview:9950:30', 'preview:9940:10']);
      vi.advanceTimersByTime(TAP_CHAIN_MS);
      const start = setup(15, 10_000);
      press(start.controller, 'back', 3);
      expect(start.events).toEqual(['tap:back:5', 'preview:0:10', 'preview:0:30']);
    });

    it('holding after presses scrubs on from their preview; closing the player drops a pending preview', () => {
      const { controller, events } = setup(100, 10_000);
      press(controller, 'forward', 3);
      controller.keyDown('forward');
      vi.advanceTimersByTime(HOLD_THRESHOLD_MS);
      expect(events.at(-1)).toBe('scrub:151:10');
      controller.cancel();
      vi.advanceTimersByTime(TAP_CHAIN_MS * 2);
      expect(events.some((e) => e.startsWith('end'))).toBe(false);
    });
  });
});
