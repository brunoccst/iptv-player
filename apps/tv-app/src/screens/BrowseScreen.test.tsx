import { act, fireEvent, render, screen } from '@testing-library/react-native';
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
});
