import { SKIP_SECONDS, clampTime } from './rules';

/** Key held longer than this becomes a scrub instead of a 10 s tap. */
export const HOLD_THRESHOLD_MS = 450;
/** Scrub preview update interval. */
export const SCRUB_TICK_MS = 100;
/** Media seconds per real second when scrubbing starts; doubles every `SCRUB_DOUBLING_MS`, capped. */
export const SCRUB_BASE_SPEED = 10;
export const SCRUB_DOUBLING_MS = 1500;
export const SCRUB_MAX_SPEED = 640;

/** Presses closer together than this continue a series of presses (issue #121); the video jumps this long after the last. */
export const TAP_CHAIN_MS = 1000;
/** Seconds each press of a series moves: 10 s, 30 s, 1 min, 2 min, then 5 min per press (D-150). */
const TAP_STEPS = [10, 30, 60, 120];
const LAST_TAP_STEP = 300;
/** How far the `count`-th press of a series in one direction moves (1-based). */
export const tapStep = (count: number) => TAP_STEPS[count - 1] ?? LAST_TAP_STEP;

export type SeekDirection = 'back' | 'forward';

/**
 * Presses in a row for skip buttons and gestures that seek at once (D-150): the on-screen ±10 s buttons, double taps
 * on phones, the arrow keys and buttons on web and desktop. A press in the same direction within `TAP_CHAIN_MS` of the
 * last moves the next step of `tapStep` (10 s, 30 s, 1 min, 2 min, then 5 min); the other way or after a pause starts
 * again at 10 s.
 */
export class SkipStreak {
  private last: { direction: SeekDirection; count: number; at: number } | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  /** Seconds this press skips. */
  press(direction: SeekDirection): number {
    const at = this.now();
    const last = this.last;
    const count = last && last.direction === direction && at - last.at < TAP_CHAIN_MS ? last.count + 1 : 1;
    this.last = { direction, count, at };
    return tapStep(count);
  }

  reset() {
    this.last = null;
  }
}

export interface RemoteSeekCallbacks {
  getTime(): number;
  getDuration(): number;
  /** Short press: seek immediately. */
  onTap(direction: SeekDirection, target: number): void;
  /**
   * Called every tick while scrubbing, and on each press of a series after the first; the UI shows the preview
   * position, playback does not move yet. `step`: the seconds a press of a series moved (none while holding).
   */
  onScrub(previewTime: number, speed: number, direction: SeekDirection, step?: number): void;
  /** Key released after scrubbing: seek once to the final preview position. */
  onScrubEnd(finalTime: number): void;
}

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** Media seconds per real second after holding for `heldMs` beyond the threshold. */
export function scrubSpeed(heldMs: number): number {
  return Math.min(SCRUB_MAX_SPEED, SCRUB_BASE_SPEED * 2 ** Math.floor(Math.max(0, heldMs) / SCRUB_DOUBLING_MS));
}

/**
 * D-pad Left/Right state machine for the TV player: tap = ±10 s, hold = accelerating scrub.
 * Android auto-repeats key-down while held; repeats are ignored. See DECISIONS.md#d-028.
 *
 * Presses in a row also go faster (issue #121, D-128): some remotes report arrows only on release, so holding never
 * scrubs there. The first press seeks 10 s at once; each further press within `TAP_CHAIN_MS` moves the preview by a
 * growing step (30 s, 1 min, 2 min, then 5 min; D-150) and the video jumps there once the presses stop. A press the
 * other way continues from the preview with the smallest step, to fine-tune.
 */
export class RemoteSeekController {
  private direction: SeekDirection | null = null;
  private holdTimer: unknown = null;
  private scrubTimer: unknown = null;
  private scrubStartedAt = 0;
  private preview = 0;
  /** The current series of presses; `pending`: the preview has not been seeked to yet. */
  private chain: { direction: SeekDirection; count: number; preview: number; pending: boolean } | null = null;
  private chainTimer: unknown = null;

  constructor(
    private readonly callbacks: RemoteSeekCallbacks,
    private readonly clock: Clock = systemClock,
  ) {}

  get isScrubbing(): boolean {
    return this.scrubTimer !== null;
  }

  keyDown(direction: SeekDirection) {
    if (this.direction === direction) return; // auto-repeat
    if (this.direction) this.keyUp(this.direction); // switched direction mid-press: finish the first one
    this.direction = direction;
    this.holdTimer = this.clock.setTimeout(() => this.beginScrub(), HOLD_THRESHOLD_MS);
  }

  keyUp(direction: SeekDirection) {
    if (this.direction !== direction) return;
    if (this.isScrubbing) {
      this.stopTimers();
      this.callbacks.onScrubEnd(this.preview);
    } else {
      this.stopTimers();
      this.tap(direction);
    }
    this.direction = null;
  }

  /** Abandons any press without seeking (e.g. player closed). */
  cancel() {
    this.stopTimers();
    this.endChain();
    this.direction = null;
  }

  private tap(direction: SeekDirection) {
    const sign = direction === 'forward' ? 1 : -1;
    const duration = this.callbacks.getDuration();
    const chain = this.chain;
    if (this.chainTimer !== null) this.clock.clearTimeout(this.chainTimer);
    if (!chain) {
      const target = clampTime(this.callbacks.getTime() + sign * SKIP_SECONDS, duration);
      this.callbacks.onTap(direction, target);
      this.chain = { direction, count: 1, preview: target, pending: false };
    } else {
      const count = chain.direction === direction ? chain.count + 1 : 1;
      const step = tapStep(count);
      const from = chain.pending ? chain.preview : this.callbacks.getTime();
      const preview = clampTime(from + sign * step, duration);
      this.chain = { direction, count, preview, pending: true };
      this.callbacks.onScrub(preview, step, direction, step);
    }
    this.chainTimer = this.clock.setTimeout(() => {
      this.chainTimer = null;
      const ended = this.chain;
      this.chain = null;
      if (ended?.pending) this.callbacks.onScrubEnd(ended.preview);
    }, TAP_CHAIN_MS);
  }

  private endChain() {
    if (this.chainTimer !== null) this.clock.clearTimeout(this.chainTimer);
    this.chainTimer = null;
    this.chain = null;
  }

  private beginScrub() {
    this.holdTimer = null;
    // Holding after a series of presses continues from its preview.
    const chain = this.chain;
    this.endChain();
    this.preview = chain?.pending ? chain.preview : this.callbacks.getTime();
    this.scrubStartedAt = this.clock.now();
    this.scrubTimer = this.clock.setInterval(() => this.tick(), SCRUB_TICK_MS);
    this.tick();
  }

  private tick() {
    if (!this.direction) return;
    const speed = scrubSpeed(this.clock.now() - this.scrubStartedAt);
    const sign = this.direction === 'forward' ? 1 : -1;
    this.preview = clampTime(this.preview + (sign * speed * SCRUB_TICK_MS) / 1000, this.callbacks.getDuration());
    this.callbacks.onScrub(this.preview, speed, this.direction);
  }

  private stopTimers() {
    if (this.holdTimer !== null) this.clock.clearTimeout(this.holdTimer);
    if (this.scrubTimer !== null) this.clock.clearInterval(this.scrubTimer);
    this.holdTimer = null;
    this.scrubTimer = null;
  }
}
