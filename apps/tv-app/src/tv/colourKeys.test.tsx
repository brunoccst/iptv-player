import { act, render } from '@testing-library/react-native';
import { navStore, stores } from '../appContext';
import { setupApp } from '../../test/utils';
import { pressRemote } from '../../test/remoteMock';
import { Platform } from 'react-native';
import { blurTitle, COLOUR_KEY_COLOURS, ColourDot, ColourKeys, colourTitle, focusTitle } from './colourKeys';

const card = { id: 'm1', title: 'Big Test Movie', year: 2020, posterUrl: null };

describe('the remote colour keys (D-154)', () => {
  it('Red puts the focused title on My List; Blue opens Live TV; Yellow starts a search from anywhere', async () => {
    setupApp();
    const toggle = jest.fn(async () => undefined);
    stores.watchlist.setState({ toggle });
    await render(<ColourKeys />);

    // Nothing focused: Red does nothing.
    await act(async () => pressRemote('red', 'up'));
    expect(toggle).not.toHaveBeenCalled();
    focusTitle({ section: 'movies', card });
    await act(async () => pressRemote('red', 'up'));
    expect(toggle).toHaveBeenCalledWith('movies', card);
    blurTitle('m1');
    expect(colourTitle()).toBeNull();

    await act(async () => pressRemote('blue', 'up'));
    expect(navStore.getState().stack).toEqual([{ name: 'section', section: 'live' }]);

    // Yellow over details: back to the page under them, and the search box asked to start typing.
    navStore.getState().push({ name: 'details', section: 'movies', masterId: 'm1' });
    await act(async () => pressRemote('yellow', 'up'));
    expect(navStore.getState().stack).toEqual([{ name: 'section', section: 'live' }]);
    expect(navStore.getState().searchRequested).toBe(true);
  });

  it('Green plays the first title of Continue Watching; in the player the player handles Red, Green and Blue', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/profiles/p1/progress', {
      body: [
        {
          kind: 'movie',
          itemId: '101',
          masterId: 'm1',
          title: 'Big Test Movie',
          posterUrl: null,
          positionSeconds: 600,
          durationSeconds: 6000,
          updatedAt: '2026-10-07T00:00:00Z',
        },
      ],
    });
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    const toggle = jest.fn(async () => undefined);
    stores.watchlist.setState({ toggle });
    await render(<ColourKeys />);

    await act(async () => pressRemote('green', 'up'));
    const top = navStore.getState().stack.at(-1);
    expect(top).toMatchObject({ name: 'player', target: { kind: 'movie', streamId: '101' } });

    focusTitle({ section: 'movies', card });
    await act(async () => pressRemote('red', 'up'));
    await act(async () => pressRemote('blue', 'up'));
    expect(toggle).not.toHaveBeenCalled();
    expect(navStore.getState().stack.at(-1)).toBe(top);
    blurTitle('m1');
  });
});

describe('ColourDot', () => {
  it('marks a button on TV only', async () => {
    const isTV = jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const view = await render(<ColourDot colour="yellow" />);
    expect(view.getByTestId('colour-dot-yellow')).toHaveStyle({ backgroundColor: COLOUR_KEY_COLOURS.yellow });
    isTV.mockReturnValue(false);
    await view.rerender(<ColourDot colour="yellow" />);
    expect(view.queryByTestId('colour-dot-yellow')).toBeNull();
    isTV.mockRestore();
  });
});
