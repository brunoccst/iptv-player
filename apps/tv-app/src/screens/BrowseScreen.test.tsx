import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { setupApp } from '../../test/utils';
import { BrowseScreen } from './BrowseScreen';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

describe('BrowseScreen (TV)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the grid in a plain scroll view and loads the next page near its end (D-093)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/catalog/movies/categories', { body: [] });
    backend.on('GET', '/api/library/movies', ({ url }) => {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      return {
        body: {
          total: 160000,
          sorts: ['added', 'title'],
          items: Array.from({ length: limit }, (_, i) => ({
            id: `m${offset + i}`,
            title: `Movie ${offset + i}`,
            year: 2000,
            posterUrl: null,
            rating: null,
            bestQuality: null,
            variantCount: 1,
          })),
        },
      };
    });
    const offsets = () =>
      backend.calls.filter((call) => call.url.pathname === '/api/library/movies').map((call) => call.url.searchParams.get('offset'));

    await render(<BrowseScreen section="movies" />);
    await flush();
    const grid = screen.getByTestId('browse-movies');
    // A FlatList got a 2 px viewport on Android TV and froze the page: TV uses a plain ScrollView, so the whole first
    // page is there (a FlatList would render its first three lines only).
    expect(screen.getByTestId('card-Movie 0')).toBeTruthy();
    expect(screen.getByTestId('card-Movie 99')).toBeTruthy();
    expect(offsets()).toEqual(['0']);

    // Laid out 1000 dp high, content 6000 dp: nothing more until the end is within 1.5 screens.
    await fireEvent(grid, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 1920, height: 1000 } } });
    await fireEvent(grid, 'contentSizeChange', 1920, 6000);
    await flush();
    expect(offsets()).toEqual(['0']);
    await fireEvent.scroll(grid, {
      nativeEvent: {
        contentOffset: { x: 0, y: 3600 },
        layoutMeasurement: { width: 1920, height: 1000 },
        contentSize: { width: 1920, height: 6000 },
      },
    });
    await flush();
    expect(offsets()).toEqual(['0', '100']);
    expect(screen.getByTestId('card-Movie 150')).toBeTruthy();
  });

  it('keeps only the lines near the focused one mounted (D-094)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/catalog/movies/categories', { body: [] });
    backend.on('GET', '/api/library/movies', {
      body: {
        total: 100,
        sorts: ['added'],
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `m${i}`,
          title: `Movie ${i}`,
          year: 2000,
          posterUrl: null,
          rating: null,
          bestQuality: null,
          variantCount: 1,
        })),
      },
    });
    await render(<BrowseScreen section="movies" />);
    await flush();
    // Only the centering moves the page: Android's own D-pad scrolling is off (D-098).
    expect(screen.getByTestId('browse-movies')).toHaveProp('scrollEnabled', false);
    // Before a line is measured every line is mounted; once its height is known, far lines become spacers.
    await fireEvent(screen.getByTestId('grid-line-0'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 900, height: 400 } } });
    expect(screen.getByTestId('grid-line-6')).toBeTruthy();
    expect(screen.getByTestId('grid-spacer-9')).toHaveStyle({ height: 400 });
    expect(screen.queryByTestId('card-Movie 99')).toBeNull();

    // Focusing a title further down moves the mounted window with it.
    const line = screen.getByTestId('grid-line-6');
    const card = within(line).getAllByRole('button')[0]!;
    await fireEvent(card, 'focus');
    expect(screen.getByTestId('grid-line-12')).toBeTruthy();
    await fireEvent(within(screen.getByTestId('grid-line-12')).getAllByRole('button')[0]!, 'focus');
    expect(screen.getByTestId('grid-line-18')).toBeTruthy();
    expect(screen.getByTestId('grid-spacer-1')).toHaveStyle({ height: 400 });
    // The first line stays mounted: its first card takes the focus when it mounts (D-099).
    expect(screen.getByTestId('grid-line-0')).toBeTruthy();
  });
});
