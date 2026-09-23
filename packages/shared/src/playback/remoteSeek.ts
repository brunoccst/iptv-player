import { SKIP_SECONDS, clampTime } from './rules';

/** Key held longer than this becomes a scrub instead of a 10 s tap. */
export const HOLD_THRESHOLD_MS = 450;
/** Scrub preview update interval. */
export const SCRUB_TICK_MS = 100;
/** Media seconds per real second when scrubbing starts; doubles every `SCRUB_DOUBLING_MS`, capped. */
export const SCRUB_BASE_SPEED = 10;
export const SCRUB_DOUBLING_MS = 1500;
export const SCRUB_MAX_SPEED = 640;

export type SeekDirection = 'back' | 'forward';

export interface RemoteSeekCallbacks {
  getTime(): number;
  getDuration(): number;
  /** Short press: seek immediately. */
  onTap(direction: SeekDirection, target: number): void;
  /** Called every tick while scrubbing; UI shows the preview position, playback does not move yet. */
  onScrub(previewTime: number, speed: number, direction: SeekDirection): void;
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
 */
export class RemoteSeekController {
  private direction: SeekDirection | null = null;
  private holdTimer: unknown = null;
  private scrubTimer: unknown = null;
  private scrubStartedAt = 0;
  private preview = 0;

  constructor(private readonly callbacks: RemoteSeekCallbacks, private readonly clock: Clock = systemClock) {}

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
    const sign = direction === 'forward' ? 1 : -1;
    if (this.isScrubbing) {
      this.stopTimers();
      this.callbacks.onScrubEnd(this.preview);
    } else {
      this.stopTimers();
      this.callbacks.onTap(direction, clampTime(this.callbacks.getTime() + sign * SKIP_SECONDS, this.callbacks.getDuration()));
    }
    this.direction = null;
  }

  /** Abandons any press without seeking (e.g. player closed). */
  cancel() {
    this.stopTimers();
    this.direction = null;
  }

  private beginScrub() {
    this.holdTimer = null;
    this.preview = this.callbacks.getTime();
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
