// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProgressDto } from './api/types';
import { createAppHooks } from './hooks';
import type { ContinueCard } from './playback/watched';
import { createMemoryStorage } from './stores/storage';
import { account, createFakeBackend, createTestAppContext, profile } from './testing/fakeBackend';

const progress = (itemId: string, position: number, updatedAt: string, seriesId: string | null = 's1'): ProgressDto => ({
  kind: seriesId ? 'episode' : 'movie',
  itemId,
  masterId: seriesId ? 'show' : 'm1',
  seriesId,
  seasonNumber: seriesId ? 1 : null,
  episodeNumber: seriesId ? Number(itemId.slice(1)) : null,
  title: seriesId ? 'Dark Matter' : 'Heat',
  posterUrl: null,
  containerExtension: 'mp4',
  positionSeconds: position,
  durationSeconds: 2400,
  updatedAt,
});

const episode = (id: string, n: number) => ({
  id,
  title: `E${n}`,
  episodeNumber: n,
  seasonNumber: 1,
  durationSeconds: 2400,
  containerExtension: 'mp4',
  plot: null,
  stillUrl: null,
});

async function setup(items: ProgressDto[]) {
  const backend = createFakeBackend();
  backend.on('POST', '/api/auth/login', {
    body: { token: 't', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile('p1')] },
  });
  backend.on('GET', '/api/profiles/p1/progress', { body: items });
  backend.on('GET', '/api/catalog/series/s1', {
    body: {
      summary: { id: 's1', name: 'Dark Matter', categoryId: null, genre: null, lastModifiedAt: null, plot: null, posterUrl: null },
      backdropUrls: [],
      cast: null,
      director: null,
      trailerYoutubeId: null,
      seasons: [{ number: 1, name: 'Season 1', coverUrl: null, episodes: [episode('e1', 1), episode('e2', 2), episode('e3', 3)] }],
    },
  });
  const { stores, api } = createTestAppContext({ config: { appName: 'T', appSlug: 't' }, storage: createMemoryStorage(), backend });
  await stores.session.getState().login({ serverUrl: 's', username: 'u', password: 'p' });
  stores.session.getState().selectProfile('p1');
  await stores.progress.getState().load('p1');
  await stores.profilePrefs.getState().load();
  const hooks = createAppHooks({ api, stores, reloadLists: () => {} });
  let cards: ContinueCard[] = [];
  function Row() {
    cards = hooks.useContinueWatching();
    return null;
  }
  render(<Row />);
  return { stores, cards: () => cards };
}

const describeCard = (card: ContinueCard) => (card.kind === 'next' ? `next ${card.episode.id}` : `resume ${card.progress.itemId}`);

describe('Continue Watching row (D-245)', () => {
  it('a finished episode brings the next one; the movie in progress stays', async () => {
    const { cards } = await setup([progress('m', 600, '2026-01-01', null), progress('e1', 2390, '2026-01-02')]);
    await waitFor(() => expect(cards().map(describeCard)).toEqual(['next e2', 'resume m']));
  });

  it('skips episodes already watched and leaves the row after the last one', async () => {
    const { cards } = await setup([progress('e2', 2390, '2026-01-01'), progress('e1', 2390, '2026-01-02')]);
    await waitFor(() => expect(cards().map(describeCard)).toEqual(['next e3']));

    const done = await setup([progress('e3', 2390, '2026-01-02')]);
    // The series list is read, and no episode follows the last one.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(done.cards()).toEqual([]);
  });

  it('a removed next-episode card stays away until another episode is watched', async () => {
    const { stores, cards } = await setup([progress('e1', 2390, '2026-01-02')]);
    await waitFor(() => expect(cards().map(describeCard)).toEqual(['next e2']));
    await act(() => stores.profilePrefs.getState().update('p1', { upNextHidden: ['e1'] }));
    expect(cards()).toEqual([]);
  });
});
