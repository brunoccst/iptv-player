import { centeredOffset } from './CenterScroll';

describe('centeredOffset (D-094)', () => {
  it('puts the focused element in the middle of the scroll view', () => {
    // View 1000 high from y=0; element 300 high at y=900 on screen, page scrolled by 500.
    expect(centeredOffset(500, 0, 1000, 900, 300)).toBe(500 + 900 - 350);
    // Already in the middle: nothing moves.
    expect(centeredOffset(200, 100, 1000, 450, 300)).toBe(200);
    // Near the top of the page it cannot scroll above 0.
    expect(centeredOffset(0, 0, 1000, 100, 300)).toBe(0);
  });
});
