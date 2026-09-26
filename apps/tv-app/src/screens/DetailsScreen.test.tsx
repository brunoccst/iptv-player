import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { navStore } from '../appContext';
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
});
