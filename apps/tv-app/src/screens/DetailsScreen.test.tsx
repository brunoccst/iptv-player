import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { navStore, stores } from '../appContext';
import { setupApp, variant } from '../../test/utils';
import { DetailsScreen } from './DetailsScreen';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const episode = (id: string, seasonNumber: number, episodeNumber: number) => ({
  id,
  seasonNumber,
  episodeNumber,
  title: `${id} title`,
  plot: null,
  durationSeconds: 2400,
  stillUrl: null,
  containerExtension: 'mkv',
});
const series = (id: string, seasons: { number: number; episodes: ReturnType<typeof episode>[] }[]) => ({
  summary: {
    id,
    name: id,
    categoryId: null,
    posterUrl: null,
    rating: null,
    plot: null,
    genre: null,
    releaseDate: null,
    lastModifiedAt: null,
  },
  cast: null,
  director: null,
  backdropUrls: [],
  trailerYoutubeId: null,
  seasons: seasons.map((season) => ({ ...season, name: `Season ${season.number}`, coverUrl: null })),
});

describe('series details: one episode list for all versions (D-066)', () => {
  it('lists every version’s episodes; each plays in the chosen version where it has it', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/series/show', {
      body: {
        id: 'show',
        title: 'Show',
        year: 2020,
        posterUrl: null,
        rating: null,
        bestQuality: '4K',
        variants: [variant('en', 'ENG 4K'), variant('ge', 'GER')],
      },
    });
    // The English 4K version lacks episode 2; the German one has all three.
    backend.on('GET', '/api/catalog/series/en', {
      body: series('en', [{ number: 1, episodes: [episode('en-1', 1, 1), episode('en-3', 1, 3)] }]),
    });
    backend.on('GET', '/api/catalog/series/ge', {
      body: series('ge', [{ number: 1, episodes: [episode('ge-1', 1, 1), episode('ge-2', 1, 2), episode('ge-3', 1, 3)] }]),
    });

    await render(<DetailsScreen section="series" masterId="show" />);
    await flush();
    const list = within(screen.getByTestId('episodes'));
    expect(list.getByText('en-1 title')).toBeTruthy();
    expect(list.getByText('ge-2 title')).toBeTruthy();
    expect(list.getByText('Only in GER')).toBeTruthy();
    expect(list.getByText('en-3 title')).toBeTruthy();

    // Play episode 2: the German version, the only one that has it.
    await fireEvent.press(screen.getByTestId('episode-ge-2'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player', target: { streamId: 'ge-2', seriesId: 'ge' } });

    // Episode 1 can play in German instead of the best (English) version.
    await fireEvent.press(screen.getByTestId('episode-en-1-version'));
    await fireEvent.press(screen.getByLabelText('GER'));
    await fireEvent.press(screen.getByTestId('episode-ge-1'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player', target: { streamId: 'ge-1', seriesId: 'ge' } });
  });

  it('TV: entering an episode from above lands on Play (first in the row), not on the nearest button', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/library/series/show', {
      body: {
        id: 'show',
        title: 'Show',
        year: 2020,
        posterUrl: null,
        rating: null,
        bestQuality: null,
        variants: [variant('en', 'ENG'), variant('ge', 'GER')],
      },
    });
    backend.on('GET', '/api/catalog/series/en', { body: series('en', [{ number: 1, episodes: [episode('en-1', 1, 1)] }]) });
    backend.on('GET', '/api/catalog/series/ge', { body: series('ge', [{ number: 1, episodes: [episode('ge-1', 1, 1)] }]) });
    await render(<DetailsScreen section="series" masterId="show" />);
    await flush();
    // The D-pad stays in the panel in every direction: the page behind is never reached (D-075).
    expect(screen.getByTestId('details-screen').props).toMatchObject({
      trapFocusUp: true,
      trapFocusDown: true,
      trapFocusLeft: true,
      trapFocusRight: true,
    });

    const play = screen.getByTestId('episode-en-1');
    let row = play.parent;
    while (row && row.props.autoFocus !== true) row = row.parent;
    expect(row?.props).toMatchObject({ autoFocus: true, trapFocusLeft: true, trapFocusRight: true });
    // Play comes before the version picker, so it is the row's first focusable item.
    const ids = within(row!)
      .getAllByTestId(/^episode-en-1/)
      .map((node) => node.props.testID);
    expect(ids[0]).toBe('episode-en-1');
    expect(ids).toContain('episode-en-1-version');
    jest.restoreAllMocks();
  });
});

describe('watched episodes and series (D-082)', () => {
  it('marks episodes with the check button or by holding OK; every episode watched tags the series', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/series/show', {
      body: {
        id: 'show',
        title: 'Show',
        year: 2020,
        posterUrl: null,
        rating: null,
        bestQuality: null,
        variants: [variant('en', 'ENG'), variant('ge', 'GER')],
      },
    });
    backend.on('GET', '/api/catalog/series/en', {
      body: series('en', [{ number: 1, episodes: [episode('en-1', 1, 1), episode('en-3', 1, 3)] }]),
    });
    backend.on('GET', '/api/catalog/series/ge', {
      body: series('ge', [{ number: 1, episodes: [episode('ge-1', 1, 1), episode('ge-2', 1, 2), episode('ge-3', 1, 3)] }]),
    });
    for (const id of ['en-1', 'ge-1', 'ge-2', 'en-3', 'ge-3']) {
      backend.on('PUT', `/api/profiles/p1/progress/episode/${id}`, ({ body }) => ({
        body: { kind: 'episode', itemId: id, updatedAt: '2026-09-27T00:00:00Z', ...(body as object) },
      }));
      backend.on('DELETE', `/api/profiles/p1/progress/episode/${id}`, { status: 204 });
    }
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    await render(<DetailsScreen section="series" masterId="show" />);
    await flush();
    const puts = () => backend.calls.filter((c) => c.method === 'PUT').map((c) => c.url.pathname.split('/').pop());

    // The row keeps Play, "…" and the version choice (D-083); the rest is in the episode's menu.
    expect(screen.queryByTestId('download-button')).toBeNull();
    expect(screen.queryByTestId('episode-en-1-mark')).toBeNull();
    await fireEvent.press(screen.getByTestId('episode-en-1-more'));
    const menu = within(screen.getByTestId('card-menu'));
    expect(menu.getByText('Download')).toBeTruthy();
    expect(menu.getByText('Open in another player')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('card-menu-watched'));
    await flush();
    expect(puts()).toEqual(['en-1']);
    expect(backend.calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ masterId: 'show', seriesId: 'en', episodeNumber: 1 });
    expect(screen.getByTestId('episode-en-1-watched')).toBeTruthy();
    expect(screen.queryByTestId('details-watched')).toBeNull();

    // Holding OK on an episode's Play button opens its menu.
    await fireEvent(screen.getByTestId('episode-ge-2'), 'longPress');
    expect(within(screen.getByTestId('card-menu')).getByText('Mark as watched')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('card-menu-watched'));
    await fireEvent.press(screen.getByTestId('episode-en-3-more'));
    await fireEvent.press(screen.getByTestId('card-menu-watched'));
    await flush();
    expect(puts()).toEqual(['en-1', 'ge-2', 'en-3']);
    // Every episode watched: the tag next to the title, and the note behind the series cover's tag.
    expect(screen.getByTestId('details-watched')).toBeTruthy();
    expect(stores.profilePrefs.getState().prefs.p1?.watchedSeries).toEqual(['show']);

    await fireEvent.press(screen.getByTestId('episode-en-1-more'));
    await fireEvent.press(screen.getByTestId('card-menu-unwatched'));
    await flush();
    expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname.split('/').pop())).toEqual(['en-1']);
    expect(screen.queryByTestId('episode-en-1-watched')).toBeNull();
    expect(screen.queryByTestId('details-watched')).toBeNull();
    expect(stores.profilePrefs.getState().prefs.p1?.watchedSeries).toEqual([]);
  });
});
