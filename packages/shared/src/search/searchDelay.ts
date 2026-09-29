/**
 * How long Search waits after the last key before it searches: a big library makes each search take a moment, and
 * searching mid-word froze the typing. Waits about twice the user's usual gap between keys (slower on a TV remote,
 * quicker on a phone keyboard), never less than MIN nor more than MAX.
 */
export const SEARCH_DELAY_MIN_MS = 400;
export const SEARCH_DELAY_MAX_MS = 1200;
/** A single letter matches most of a library; wait for more. */
export const SEARCH_MIN_LENGTH = 2;

/** `gaps`: recent times between keystrokes, in ms. Pauses longer than MAX are not typing and are ignored. */
export function searchDelay(gaps: number[]): number {
  const typing = gaps.filter((gap) => gap > 0 && gap < SEARCH_DELAY_MAX_MS).slice(-5);
  if (typing.length === 0) return SEARCH_DELAY_MIN_MS;
  const sorted = [...typing].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return Math.min(SEARCH_DELAY_MAX_MS, Math.max(SEARCH_DELAY_MIN_MS, Math.round(median * 2)));
}
