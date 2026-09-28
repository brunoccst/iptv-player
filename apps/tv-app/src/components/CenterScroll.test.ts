import { centeredOffset } from './CenterScroll';

describe('centeredOffset (D-094, D-095)', () => {
  it('puts the focused element in the middle of the viewport, from its place in the page', () => {
    // Element 300 high at 2000 inside the page, viewport 1000: scroll to 2000 - 350.
    expect(centeredOffset(2000, 300, 1000)).toBe(1650);
    // The same element always gives the same offset, whatever the page is scrolled to right now.
    expect(centeredOffset(2000, 300, 1000)).toBe(centeredOffset(2000, 300, 1000));
    // Near the top of the page it cannot scroll above 0.
    expect(centeredOffset(100, 300, 1000)).toBe(0);
  });
});
