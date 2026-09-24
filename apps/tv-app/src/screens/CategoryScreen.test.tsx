import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { navStore } from '../appContext';
import { App } from '../App';
import { setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

const card = (n: number) => ({
  id: `m${n}`,
  title: `Drama ${n}`,
  year: 2020,
  posterUrl: null,
  rating: null,
  bestQuality: null,
  variantCount: 1,
});

describe('Category pages (TV)', () => {
  it('opens one category from its row title and loads the next page near the end', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/catalog/movies/categories', { body: [{ id: '7', name: 'Drama', parentId: null }] });
    let release!: () => void;
    const secondPage = new Promise<void>((resolve) => (release = resolve));
    backend.on('GET', '/api/library/movies', async ({ url }) => {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      if (offset > 0) await secondPage;
      const limit = Number(url.searchParams.get('limit'));
      const total = url.searchParams.get('categoryId') === '7' ? 70 : 0;
      return { body: { total, items: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => card(offset + i)) } };
    });
    navStore.setState({ stack: [{ name: 'section', section: 'movies' }], railCollapsed: false });

    await render(<App />);
    await flush();
    await fireEvent.press(await screen.findByTestId('row-movies-7-open'));
    await flush();

    const grid = await screen.findByTestId('category-movies-7');
    expect(screen.getByText('Drama')).toBeTruthy();
    expect(screen.getByText('70 titles')).toBeTruthy();
    const pageCalls = () =>
      backend.calls.filter((c) => c.url.pathname === '/api/library/movies' && c.url.searchParams.get('categoryId') === '7');
    const before = pageCalls().length;

    await act(async () => grid.props.onEndReached?.({ distanceFromEnd: 0 }));
    expect(screen.getByLabelText('Loading more')).toBeTruthy();
    release();
    await flush();
    expect(pageCalls().length).toBe(before + 1);
    expect(pageCalls().at(-1)!.url.searchParams.get('offset')).toBe('60');
    expect(screen.queryByLabelText('Loading more')).toBeNull();
  });
});
