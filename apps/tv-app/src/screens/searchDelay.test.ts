import { searchDelay, SEARCH_DELAY_MAX_MS, SEARCH_DELAY_MIN_MS } from './searchDelay';

describe('searchDelay', () => {
  it('waits about twice the usual gap between keys, within limits', () => {
    expect(searchDelay([])).toBe(SEARCH_DELAY_MIN_MS);
    expect(searchDelay([80, 90, 100])).toBe(SEARCH_DELAY_MIN_MS);
    expect(searchDelay([300, 350, 320])).toBe(640);
    expect(searchDelay([900, 1000, 1100])).toBe(SEARCH_DELAY_MAX_MS);
    // A long pause is not typing speed.
    expect(searchDelay([250, 5000, 260])).toBe(520);
  });
});
