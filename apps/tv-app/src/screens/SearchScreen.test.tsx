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

  it('finds programmes of the TV guide, on now first; Select plays their channel (issue #119)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [] } });
    backend.on('GET', '/api/library/series', { body: { total: 0, items: [] } });
    backend.on('GET', '/api/catalog/live/channels', { body: [] });
    // Midday, so the programme after the one on now starts the same day ("Tomorrow · …" otherwise, from 23:20 on).
    const midday = new Date();
    midday.setHours(12, 0, 0, 0);
    jest.useFakeTimers({
      now: midday,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'hrtime',
        'performance',
      ],
    });
    const now = Date.now();
    const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
    const sport = { id: '7', name: 'Sport 1', categoryId: '2', number: 7, logoUrl: null, epgChannelId: 'sport', hasCatchup: false };
    backend.on('GET', '/api/catalog/live/programmes', ({ url }) => ({
      body:
        url.searchParams.get('search') === 'final'
          ? [
              { channel: sport, programme: { title: 'Cup Final', start: at(-20), end: at(40), description: null } },
              { channel: sport, programme: { title: 'Cup Final Highlights', start: at(40), end: at(70), description: null } },
            ]
          : [],
    }));
    await render(<App />);
    await flush();
    await fireEvent.changeText(screen.getByTestId('nav-search'), 'final');
    await flush(450);

    const row = await screen.findByTestId('row-programme-search');
    expect(within(row).getByText('On TV')).toBeTruthy();
    expect(within(row).getAllByText('Cup Final').length).toBeGreaterThan(0);
    expect(within(row).getByText(/^Sport 1 · Now · /)).toBeTruthy();
    expect(within(row).getByText(/^Sport 1 · \d/)).toBeTruthy();
    await fireEvent.press(within(row).getByTestId('card-Cup Final'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({
      name: 'player',
      target: { kind: 'live', streamId: '7', title: 'Sport 1', subtitle: 'Cup Final' },
    });
    jest.useRealTimers();
  });

  it('filters the results to movies, series or live channels; the title stays above them (D-108)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/movies', { body: { total: 1, items: [card('m1', 'News of the World')] } });
    backend.on('GET', '/api/library/series', { body: { total: 1, items: [card('s1', 'The Newsroom')] } });
    backend.on('GET', '/api/catalog/live/channels', {
      body: [{ id: '1', name: 'BBC News', categoryId: null, number: 1, logoUrl: null, epgChannelId: null, hasCatchup: false }],
    });
    await render(<App />);
    await flush();
    await fireEvent.changeText(screen.getByTestId('nav-search'), 'news');
    await flush(450);

    // The title and the filter are outside the scrolling results, so they never scroll away.
    const header = screen.getByTestId('search-header');
    expect(within(header).getByText('Results for “news”')).toBeTruthy();
    expect(within(screen.getByTestId('search-results')).queryByText('Results for “news”')).toBeNull();
    expect(screen.getByTestId('search-filter-all')).toHaveProp('accessibilityState', { selected: true });
    expect(screen.getByTestId('row-movies-search')).toBeTruthy();
    expect(screen.getByTestId('row-series-search')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-filter-series'));
    await flush();
    expect(screen.queryByTestId('row-movies-search')).toBeNull();
    expect((await screen.findAllByText('The Newsroom')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('row-live-search')).toBeNull();

    await fireEvent.press(screen.getByTestId('search-filter-movies'));
    await flush();
    expect(screen.queryByTestId('row-series-search')).toBeNull();
    expect((await screen.findAllByText('News of the World')).length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId('search-filter-live'));
    await flush();
    expect(screen.queryByTestId('row-movies-search')).toBeNull();
    expect(screen.getAllByText('BBC News').length).toBeGreaterThan(0);
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
