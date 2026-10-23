/**
 * TV rows scroll themselves to the focused card (DECISIONS.md#d-181). Android's own focus scrolling moved a row just
 * enough to show the card, so the first and last cards on screen sat on the screen edge: the focused card's growth and
 * glow, and anything the TV's overscan hides, were cut off.
 */

/** Room on each side of a TV row, beyond the page gutter, for the focused card's growth (8 %) and glow. */
export const TV_ROW_SIDE_ROOM = 24;

/** Where a TV row's cards start and how far from the screen sides the focused card stays. */
export const tvRowInset = (gutter: number) => gutter + TV_ROW_SIDE_ROOM;

/**
 * Scroll offset that shows a card (`x` and `width` inside the row) with `margin` free on both sides, moving the row
 * as little as possible from `offset`; the row stays still when the card already fits. Clamped to the row's ends.
 */
export function revealOffset(x: number, width: number, offset: number, viewport: number, contentWidth: number, margin: number): number {
  const max = Math.max(0, contentWidth - viewport);
  let next = offset;
  if (x + width + margin > next + viewport) next = x + width + margin - viewport;
  if (x - margin < next) next = x - margin;
  return Math.round(Math.min(max, Math.max(0, next)));
}
