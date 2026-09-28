import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import { appLog } from '@iptv/shared';
import { navStore } from '../appContext';
import { App } from '../App';
import { setupApp } from '../../test/utils';

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

const card = (id: string, title: string) => ({ id, title, year: 2020, posterUrl: null, rating: null, bestQuality: null, variantCount: 1 });

describe('Search and Log pages (TV)', () => {
  it('searches movies, series and live channels by name', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/movies', ({ url }) => ({
      body: url.searchParams.get('search') === 'news' ? { total: 1, items: [card('m1', 'News of the World')] } : { total: 0, items: [] },
    }));
    backend.on('GET', '/api/library/series', { body: { total: 0, items: [] } });
    backend.on('GET', '/api/catalog/live/channels', {
      body: [
        { id: '1', name: 'BBC News', categoryId: null, number: 1, logoUrl: null, epgChannelId: null, hasCatchup: false },
        { id: '2', name: 'Sport 1', categoryId: null, number: 2, logoUrl: null, epgChannelId: null, hasCatchup: false },
      ],
    });
    await render(<App />);
    await flush();
    await fireEvent.changeText(screen.getByTestId('nav-search'), 'news');
    await flush(450);

    expect(screen.getByText('Results for “news”')).toBeTruthy();

    expect((await screen.findAllByText('News of the World')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('BBC News').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sport 1')).toBeNull();
    expect(screen.getByTestId('row-series-search')).toHaveTextContent(/No titles found/);
  });

  it('TV: pages of 36 results that load as the focus nears the end (D-095)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/library/movies', ({ url }) => {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      return { body: { total: 5000, items: Array.from({ length: limit }, (_, i) => card(`m${offset + i}`, `The Movie ${offset + i}`)) } };
    });
    backend.on('GET', '/api/library/series', { body: { total: 0, items: [] } });
    backend.on('GET', '/api/catalog/live/channels', { body: [] });
    await render(<App />);
    await flush();
    await fireEvent.changeText(screen.getByTestId('nav-search'), 'th');
    await fireEvent(screen.getByTestId('nav-search'), 'submitEditing');
    await flush();
    const pages = () =>
      backend.calls
        .filter((call) => call.url.pathname === '/api/library/movies' && call.url.searchParams.get('search') === 'th')
        .map((call) => `${call.url.searchParams.get('offset')}+${call.url.searchParams.get('limit')}`);
    expect(pages()).toEqual(['0+36']);

    // Focus on a title in one of the last two lines asks for the next page.
    const lines = screen.getAllByTestId(/^search-movies-line-/);
    await fireEvent(within(lines[lines.length - 1]!).getAllByRole('button')[0]!, 'focus');
    await flush();
    expect(pages()).toEqual(['0+36', '36+36']);
    jest.restoreAllMocks();
  });

  it('waits for a second letter, and Enter searches without waiting', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [] } });
    backend.on('GET', '/api/library/series', { body: { total: 0, items: [] } });
    backend.on('GET', '/api/catalog/live/channels', { body: [] });
    await render(<App />);
    await flush();
    await fireEvent.changeText(screen.getByTestId('nav-search'), 'n');
    await flush(1500);
    expect(screen.getByText('Keep typing…')).toBeTruthy();
    expect(backend.calls.some((call) => call.url.searchParams.has('search'))).toBe(false);

    await fireEvent.changeText(screen.getByTestId('nav-search'), 'ne');
    await fireEvent(screen.getByTestId('nav-search'), 'submitEditing');
    await flush();
    expect(screen.getByText('Results for “ne”')).toBeTruthy();
  });

  it('shares the log with credentials masked', async () => {
    setupApp();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    appLog.clear();
    appLog.error('player', 'attempt 1 failed: http://p.tv/movie/bob/s3cret/1.mkv');
    navStore.setState({ stack: [{ name: 'section', section: 'log' }] });

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('log-share'));

    const message = share.mock.calls[0]![0].message!;
    expect(message).toContain('diagnostics log');
    expect(message).toContain('/movie/***/***/1.mkv');
    expect(message).not.toContain('s3cret');
  });
});
