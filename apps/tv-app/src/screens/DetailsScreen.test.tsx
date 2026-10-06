import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Animated, Platform } from 'react-native';
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
  plot: null as string | null,
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

  it('a second copy of an episode in one version is a choice in its version picker, not another row', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/series/show', {
      body: {
        id: 'show',
        title: 'Show',
        year: 2020,
        posterUrl: null,
        rating: null,
        bestQuality: null,
        variants: [variant('en', 'ENG'), variant('sub', 'ENG (2)')],
      },
    });
    backend.on('GET', '/api/catalog/series/en', {
      body: series('en', [{ number: 1, episodes: [{ ...episode('en-3', 1, 3), title: 'Show - S01E03 - 9:00 A.M.' }] }]),
    });
    // The provider lists episode 3 twice in the subtitled version.
    backend.on('GET', '/api/catalog/series/sub', {
      body: series('sub', [
        {
          number: 1,
          episodes: [
            { ...episode('sub-3', 1, 3), title: 'Show [MULTI-SUB] - S01E03 - 9:00 A.M.' },
            { ...episode('sub-3b', 1, 3), title: 'Show [MULTI-SUB] - S01E03 - 9:00 A.M.' },
          ],
        },
      ]),
    });

    await render(<DetailsScreen section="series" masterId="show" />);
    await flush();
    const list = within(screen.getByTestId('episodes'));
    expect(list.getAllByText(/S01E03/)).toHaveLength(1);
    expect(list.queryByText(/^Only in/)).toBeNull();

    await fireEvent.press(screen.getByTestId('episode-en-3-version'));
    await fireEvent.press(screen.getByLabelText('ENG (2) #2'));
    await fireEvent.press(screen.getByTestId('episode-sub-3b'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player', target: { streamId: 'sub-3b', seriesId: 'sub' } });
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

  it('marks one season watched or not watched; the other seasons stay as they were (issue #132)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/series/show', {
      body: { id: 'show', title: 'Show', year: 2020, posterUrl: null, rating: null, bestQuality: null, variants: [variant('en', 'ENG')] },
    });
    backend.on('GET', '/api/catalog/series/en', {
      body: series('en', [
        { number: 1, episodes: [episode('a1', 1, 1), episode('a2', 1, 2)] },
        { number: 2, episodes: [episode('b1', 2, 1)] },
      ]),
    });
    for (const id of ['a1', 'a2', 'b1']) {
      backend.on('PUT', `/api/profiles/p1/progress/episode/${id}`, ({ body }) => ({
        body: { kind: 'episode', itemId: id, updatedAt: '2026-10-03T00:00:00Z', ...(body as object) },
      }));
      backend.on('DELETE', `/api/profiles/p1/progress/episode/${id}`, { status: 204 });
    }
    await act(async () => void (await stores.progress.getState().load('p1', { force: true })));
    await render(<DetailsScreen section="series" masterId="show" />);
    await flush();
    const toggle = () => screen.getByTestId('season-watched-toggle');

    // On the left of the season choice, in the same group as it (issue #159).
    let group = toggle().parent;
    while (group && within(group).queryByTestId('season-select') === null) group = group.parent;
    const order = within(group!)
      .getAllByTestId(/^season-/)
      .map((node) => node.props.testID)
      .filter((id, index, ids) => ids.indexOf(id) === index);
    expect(order.slice(0, 2)).toEqual(['season-watched-toggle', 'season-select']);

    expect(toggle()).toHaveProp('accessibilityLabel', 'Mark season as watched');
    await fireEvent.press(toggle());
    await flush();
    expect(backend.calls.filter((c) => c.method === 'PUT').map((c) => c.url.pathname.split('/').pop())).toEqual(['a1', 'a2']);
    expect(toggle()).toHaveProp('accessibilityLabel', 'Mark season as not watched');
    // Season 2 still to watch: the series is not watched.
    expect(screen.queryByTestId('details-watched')).toBeNull();

    await fireEvent.press(toggle());
    await flush();
    expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname.split('/').pop())).toEqual(['a1', 'a2']);
    expect(toggle()).toHaveProp('accessibilityLabel', 'Mark season as watched');
  });
});

describe('episode description (issue #160)', () => {
  it('shows two lines; a touch shows all of it, another touch folds it again', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/series/long', {
      body: { id: 'long', title: 'Long', year: 2020, posterUrl: null, rating: null, bestQuality: null, variants: [variant('lp', 'ENG')] },
    });
    backend.on('GET', '/api/catalog/series/lp', {
      body: series('lp', [{ number: 1, episodes: [{ ...episode('a1', 1, 1), plot: 'A long plot that goes on and on.' }] }]),
    });
    await render(<DetailsScreen section="series" masterId="long" />);
    await flush();
    const plot = () => screen.getByText(/A long plot that goes on and on\./);

    expect(await screen.findByText(/A long plot that goes on and on\./)).toHaveProp('numberOfLines', 2);
    // Not a D-pad stop: Play stays the first thing focused in an episode (D-083).
    expect(screen.getByTestId('plot-a1')).toHaveProp('focusable', false);
    await fireEvent.press(screen.getByTestId('plot-a1'));
    expect(plot().props.numberOfLines).toBeUndefined();
    await fireEvent.press(screen.getByTestId('plot-a1'));
    expect(plot()).toHaveProp('numberOfLines', 2);
  });
});

describe('episode description rolls on TV (issue #160)', () => {
  it('after a moment on an episode its description rolls; moving between its buttons keeps it, leaving stops it', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/library/series/roll', {
      body: { id: 'roll', title: 'Roll', year: 2020, posterUrl: null, rating: null, bestQuality: null, variants: [variant('rl', 'ENG')] },
    });
    backend.on('GET', '/api/catalog/series/rl', {
      body: series('rl', [
        {
          number: 1,
          episodes: [
            { ...episode('r1', 1, 1), plot: 'First plot.' },
            { ...episode('r2', 1, 2), plot: 'Second plot.' },
          ],
        },
      ]),
    });
    await render(<DetailsScreen section="series" masterId="roll" />);
    await flush();
    await screen.findByTestId('plot-r1');

    jest.useFakeTimers();
    await act(async () => void fireEvent(screen.getByTestId('episode-r1'), 'focus'));
    await act(async () => void jest.advanceTimersByTime(1000));
    // Not yet: it waits a moment on the episode first.
    expect(screen.queryByTestId('plot-r1-rolling')).toBeNull();
    await act(async () => void jest.advanceTimersByTime(600));
    expect(screen.getByTestId('plot-r1-rolling')).toHaveTextContent('40m · First plot.');
    expect(screen.queryByTestId('plot-r2-rolling')).toBeNull();

    // Play → "…" in the same episode: it keeps rolling.
    await act(async () => {
      fireEvent(screen.getByTestId('episode-r1'), 'blur');
      fireEvent(screen.getByTestId('episode-r1-more'), 'focus');
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('plot-r1-rolling')).toBeTruthy();

    // On to the next episode: the first one is two lines again; the next one rolls after its own wait.
    await act(async () => {
      fireEvent(screen.getByTestId('episode-r1-more'), 'blur');
      fireEvent(screen.getByTestId('episode-r2'), 'focus');
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('plot-r1-rolling')).toBeNull();
    expect(screen.getByTestId('plot-r1')).toBeTruthy();
    expect(screen.queryByTestId('plot-r2-rolling')).toBeNull();
    await act(async () => void jest.advanceTimersByTime(1500));
    expect(screen.getByTestId('plot-r2-rolling')).toBeTruthy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('a long description is not squeezed into the two lines: it keeps its height and rolls through it', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    backend.on('GET', '/api/library/series/long', {
      body: { id: 'long', title: 'Long', year: 2020, posterUrl: null, rating: null, bestQuality: null, variants: [variant('lg', 'ENG')] },
    });
    backend.on('GET', '/api/catalog/series/lg', {
      body: series('lg', [{ number: 1, episodes: [{ ...episode('l1', 1, 1), plot: 'A long plot. '.repeat(20) }] }]),
    });
    await render(<DetailsScreen section="series" masterId="long" />);
    await flush();
    await screen.findByTestId('plot-l1');

    const timing = jest.spyOn(Animated, 'timing');
    jest.useFakeTimers();
    await act(async () => void fireEvent(screen.getByTestId('episode-l1'), 'focus'));
    await act(async () => void jest.advanceTimersByTime(1600));
    const window = screen.getByTestId('plot-l1-rolling');
    const text = within(window).getByText(/A long plot/);
    // The text lies outside the window's layout, so Android measures all of it (five lines here), not two.
    expect(text).toHaveStyle({ position: 'absolute' });
    await act(async () => void fireEvent(text, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 95 } } }));
    expect(window).toHaveStyle({ height: 38, overflow: 'hidden' });
    // It rolls through the three lines past the window, a line every 3 s.
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: -57, duration: 9000 }));
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
});

describe('movie details: the best version (D-136)', () => {
  it('equally good versions: the one in the app language is the best and starts, not the first', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/movies/m', {
      body: {
        id: 'm',
        title: 'Movie',
        year: 2020,
        posterUrl: null,
        rating: null,
        bestQuality: '1080p',
        variants: [
          { ...variant('alb', '1080p · ALB'), quality: '1080p', audioLanguages: ['ALB'] },
          { ...variant('en', '1080p · ENG'), quality: '1080p', audioLanguages: ['ENG'] },
        ],
      },
    });

    await render(<DetailsScreen section="movies" masterId="m" />);
    await flush();
    expect(screen.getByText('1080p · ENG (best)')).toBeTruthy();
    expect(screen.queryByText('1080p · ALB (best)')).toBeNull();
  });
});

describe('movie details: the version a title starts with (D-144)', () => {
  it("starts with the best version in the profile's language, even when another language has a better one", async () => {
    const backend = setupApp();
    await act(async () => void (await stores.profilePrefs.getState().update('p1', { languages: ['ENG'] })));
    backend.on('GET', '/api/library/movies/m', {
      body: {
        id: 'm',
        title: 'Movie',
        year: 2020,
        posterUrl: null,
        rating: null,
        bestQuality: '4K',
        variants: [
          { ...variant('alb', '4K · ALB'), quality: '4K', audioLanguages: ['ALB'] },
          { ...variant('en-720', '720p · ENG'), quality: '720p', audioLanguages: ['ENG'] },
          { ...variant('en', '1080p · ENG'), quality: '1080p', audioLanguages: ['ENG'] },
        ],
      },
    });

    await render(<DetailsScreen section="movies" masterId="m" />);
    await flush();
    expect(screen.getByTestId('variant-button').props.accessibilityLabel).toBe('Version / Stream Quality: 1080p · ENG');
  });
});
