import { revealOffset, tvRowInset, TV_ROW_SIDE_ROOM } from './rowReveal';

describe('revealOffset (TV rows keep the focused card clear of the screen sides, D-181)', () => {
  // A 1000-wide screen, cards 200 wide with an 8 gap, starting at the 62 inset; 10 cards: content 62 + 10*208 - 8 + 62.
  const viewport = 1000;
  const margin = 62;
  const content = margin * 2 + 10 * 208 - 8;
  const cardX = (i: number) => margin + i * 208;

  it('stays still while the card already fits with the margin', () => {
    expect(revealOffset(cardX(0), 200, 0, viewport, content, margin)).toBe(0);
    expect(revealOffset(cardX(3), 200, 0, viewport, content, margin)).toBe(0);
  });

  it('moving right: the card stops the margin away from the right side, not on it', () => {
    const next = revealOffset(cardX(4), 200, 0, viewport, content, margin);
    expect(cardX(4) + 200 + margin - next).toBe(viewport);
  });

  it('moving left: the card stops the margin away from the left side', () => {
    const next = revealOffset(cardX(3), 200, 1000, viewport, content, margin);
    expect(cardX(3) - next).toBe(margin);
  });

  it('never scrolls past the row ends, so the first and last cards keep their inset', () => {
    expect(revealOffset(cardX(0), 200, 500, viewport, content, margin)).toBe(0);
    expect(revealOffset(cardX(9), 200, 0, viewport, content, margin)).toBe(content - viewport);
    expect(revealOffset(cardX(0), 200, 0, viewport, 500, margin)).toBe(0);
  });

  it('the inset is the gutter plus room for the focus growth and glow', () => {
    expect(tvRowInset(38)).toBe(38 + TV_ROW_SIDE_ROOM);
  });
});
