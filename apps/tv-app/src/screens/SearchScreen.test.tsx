import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
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

describe('Search and Log screens (TV)', () => {
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
    navStore.setState({ stack: [{ name: 'section', section: 'search' }], railCollapsed: false });

    await render(<App />);
    await flush();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'news');
    await flush(450);

    expect((await screen.findAllByText('News of the World')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('BBC News').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sport 1')).toBeNull();
    expect(screen.queryByTestId('row-series-search')).toBeNull();
  });

  it('shares the log with credentials masked', async () => {
    setupApp();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    appLog.clear();
    appLog.error('player', 'attempt 1 failed: http://p.tv/movie/bob/s3cret/1.mkv');
    navStore.setState({ stack: [{ name: 'section', section: 'log' }], railCollapsed: false });

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('log-share'));

    const message = share.mock.calls[0]![0].message!;
    expect(message).toContain('diagnostics log');
    expect(message).toContain('/movie/***/***/1.mkv');
    expect(message).not.toContain('s3cret');
  });
});
