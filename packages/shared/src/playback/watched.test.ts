import { describe, expect, it } from 'vitest';
import { createTestAppContext } from '../testing/fakeBackend';
import type { ProgressDto } from '../api/types';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { createMemoryStorage } from '../stores/storage';
import {
  allEpisodesWatched,
  cardMenuItems,
  continueWatchlistEntry,
  episodeMenuItems,
  isEpisodeWatched,
  isSeriesWatched,
  setEpisodeWatched,
  setSeriesWatched,
  isMovieWatched,
  isWatched,
  markEntryWatched,
  removeFromContinueWatching,
  setMovieWatched,
  seriesStart,
  seriesStartLabel,
  watchedRequest,
} from './watched';
import type { MergedEpisode, MergedSeries } from './seriesVersions';

const config = { appName: 'T', appSlug: 't' };
const entry = (itemId: string, position: number, extra: Partial<ProgressDto> = {}): ProgressDto => ({
  kind: 'movie',
  itemId,
  masterId: 'm1',
  seriesId: null,
  seasonNumber: null,
  episodeNumber: null,
  title: 'Heat',
  posterUrl: null,
  containerExtension: 'mp4',
  positionSeconds: position,
  durationSeconds: 6000,
  updatedAt: '2026-09-01T00:00:00Z',
  ...extra,
});
const variant = (streamId: string) => ({
  audioLanguages: [],
  audioTag: null,
  categoryId: null,
  containerExtension: 'mkv',
  isHdr: false,
  label: streamId,
  quality: null,
  rawTitle: streamId,
  source: null,
  streamId,
  subtitleLanguages: [],
});

async function setup(progress: ProgressDto[]) {
  const backend = createFakeBackend();
  backend.on('POST', '/api/auth/login', {
    body: { token: 't', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile('p1')] },
  });
  backend.on('GET', '/api/profiles/p1/progress', { body: progress });
  backend.on('GET', '/api/library/movies/m1', {
    body: {
      id: 'm1',
      title: 'Heat',
      posterUrl: 'p.jpg',
      rating: null,
      bestQuality: null,
      year: 1995,
      variants: [variant('101'), variant('102')],
    },
  });
  for (const id of ['101', '102', 'e1', 'e2']) {
    backend.on('PUT', `/api/profiles/p1/progress/movie/${id}`, ({ body }) => ({ body: { ...entry(id, 0), ...(body as object) } }));
    backend.on('PUT', `/api/profiles/p1/progress/episode/${id}`, ({ body }) => ({
      body: { ...entry(id, 0), kind: 'episode', ...(body as object) },
    }));
    backend.on('DELETE', `/api/profiles/p1/progress/movie/${id}`, { status: 204 });
    backend.on('DELETE', `/api/profiles/p1/progress/episode/${id}`, { status: 204 });
  }
  const { stores, api } = createTestAppContext({ config, storage: createMemoryStorage(), backend });
  await stores.session.getState().login({ serverUrl: 's', username: 'u', password: 'p' });
  stores.session.getState().selectProfile('p1');
  await stores.progress.getState().load('p1');
  return { backend, stores, api };
}

describe('watched titles (D-081)', () => {
  it('a title is watched when any version was finished', () => {
    expect(isWatched(entry('101', 5800))).toBe(true);
    expect(isWatched(entry('101', 600))).toBe(false);
    expect(isWatched(null)).toBe(false);
    expect(isMovieWatched([entry('101', 600), entry('102', 5990)], 'm1')).toBe(true);
    expect(isMovieWatched([entry('101', 600)], 'm1')).toBe(false);
    expect(isMovieWatched([entry('101', 5990, { masterId: 'other' })], 'm1')).toBe(false);
  });

  it('marking watched saves finished progress, 1 of 1 second when the runtime is unknown', () => {
    expect(watchedRequest({ title: 'Heat', durationSeconds: 6000 })).toMatchObject({ positionSeconds: 6000, durationSeconds: 6000 });
    const unknown = watchedRequest({ title: 'Heat' });
    expect(isWatched(unknown)).toBe(true);
  });

  it('marks a movie watched on its chosen version, and not watched by removing all its versions', async () => {
    const { backend, stores } = await setup([entry('102', 300)]);
    stores.library.getState().selectVariant('m1', '102');
    await setMovieWatched(stores, 'm1', true);
    const put = backend.calls.find((c) => c.method === 'PUT');
    expect(put?.url.pathname).toBe('/api/profiles/p1/progress/movie/102');
    expect(put?.body).toMatchObject({ positionSeconds: 6000, durationSeconds: 6000, masterId: 'm1', title: 'Heat' });
    expect(isMovieWatched(stores.progress.getState().items.data!, 'm1')).toBe(true);

    await setMovieWatched(stores, 'm1', false);
    expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname)).toEqual(['/api/profiles/p1/progress/movie/102']);
    expect(isMovieWatched(stores.progress.getState().items.data!, 'm1')).toBe(false);
  });

  it('Continue Watching: mark the episode watched, or remove the series', async () => {
    const e1 = entry('e1', 700, { kind: 'episode', seriesId: 's1', masterId: 'show' });
    const e2 = entry('e2', 900, { kind: 'episode', seriesId: 's1', masterId: 'show', updatedAt: '2026-09-02T00:00:00Z' });
    const { backend, stores } = await setup([e1, e2]);
    await markEntryWatched(stores.progress, e2);
    expect(backend.calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ positionSeconds: 6000, seriesId: 's1', masterId: 'show' });
    await removeFromContinueWatching(stores.progress, e1);
    expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname)).toEqual(['/api/profiles/p1/progress/episode/e1']);
  });

  it('card menus: continue watching, movies (watched or not), series; My List on every titled card (D-104)', () => {
    const labels = (items: { label: string }[]) => items.map((item) => item.label);
    expect(labels(cardMenuItems({ kind: 'continue', entry: entry('e1', 5, { kind: 'episode', masterId: 'show' }) }))).toEqual([
      'Go to details',
      'Mark episode as watched',
      'Add to My List',
      'Remove from Continue Watching',
    ]);
    expect(labels(cardMenuItems({ kind: 'continue', entry: entry('e1', 5, { kind: 'episode', masterId: null }) }))).toEqual([
      'Mark episode as watched',
      'Remove from Continue Watching',
    ]);
    expect(labels(cardMenuItems({ kind: 'movie', watched: false }))).toEqual(['Go to details', 'Mark as watched', 'Add to My List']);
    expect(labels(cardMenuItems({ kind: 'movie', watched: true, onList: true }))).toEqual([
      'Go to details',
      'Mark as not watched',
      'Remove from My List',
    ]);
    expect(labels(cardMenuItems({ kind: 'series', watched: false }))).toEqual([
      'Go to details',
      'Mark series as watched',
      'Add to My List',
    ]);
    expect(labels(cardMenuItems({ kind: 'series', watched: true }))).toEqual([
      'Go to details',
      'Mark series as not watched',
      'Add to My List',
    ]);
    expect(continueWatchlistEntry(entry('e1', 5, { kind: 'episode', masterId: 'show' }))).toMatchObject({
      section: 'series',
      card: { id: 'show' },
    });
    expect(continueWatchlistEntry(entry('e1', 5, { kind: 'episode', masterId: null }))).toBeNull();
  });

  it('episode menu (D-083): watched first, then what the device and profile allow', () => {
    expect(episodeMenuItems({ watched: false })).toEqual([{ id: 'watched', label: 'Mark as watched', icon: 'eye' }]);
    expect(episodeMenuItems({ watched: true, download: { status: 'none' }, tvName: 'Living room', externalPlayer: 'app' })).toEqual([
      { id: 'unwatched', label: 'Mark as not watched', icon: 'eyeOff' },
      { id: 'download', label: 'Download', icon: 'download' },
      { id: 'play-on-tv', label: 'Play on Living room', icon: 'tv' },
      { id: 'external', label: 'Open in another player', icon: 'external' },
    ]);
    const download = (status: 'downloading' | 'paused' | 'failed' | 'completed') =>
      episodeMenuItems({ watched: false, download: { status, percent: 41.6 }, externalPlayer: 'vlc' }).slice(1);
    expect(download('downloading')).toEqual([
      { id: 'download', label: 'Pause download (42 %)', icon: 'pause' },
      { id: 'external', label: 'Open in VLC', icon: 'external' },
    ]);
    expect(download('paused')[0]).toEqual({ id: 'download', label: 'Resume download (42 %)', icon: 'download' });
    expect(download('failed')[0]).toEqual({ id: 'download', label: 'Download failed · Retry', icon: 'alert' });
    expect(download('completed')[0]).toEqual({ id: 'download', label: 'Downloaded', icon: 'check', disabled: true });
  });

  describe('episodes and whole series (D-082)', () => {
    const ep = (id: string, n: number) => ({
      id,
      title: `E${n}`,
      episodeNumber: n,
      seasonNumber: 1,
      durationSeconds: 2400,
      containerExtension: 'mp4',
      plot: null,
      stillUrl: null,
    });
    const merged = (id: string, n: number) => ({
      ...ep(id, n),
      seriesId: 's1',
      versions: [{ seriesId: 's1', label: 'ENG', episode: ep(id, n) }],
    });
    const seriesBody = (seriesId: string, ids: string[]) => ({
      summary: { id: seriesId, name: 'Show', categoryId: null, genre: null, lastModifiedAt: null, plot: null, posterUrl: null },
      backdropUrls: [],
      cast: null,
      director: null,
      trailerYoutubeId: null,
      seasons: [{ number: 1, name: 'Season 1', coverUrl: null, episodes: ids.map((id, i) => ep(id, i + 1)) }],
    });

    it('marks one episode, and says when every episode is watched', async () => {
      const { backend, stores } = await setup([]);
      const series = {
        seasons: [
          {
            number: 1,
            name: 'S1',
            coverUrl: null,
            episodes: [merged('e1', 1), merged('e2', 2)],
          },
        ],
      };
      const [e1, e2] = series.seasons[0]!.episodes;
      expect(allEpisodesWatched(stores.progress.getState(), series)).toBe(false);
      await setEpisodeWatched(stores.progress, e1!, { title: 'Show', masterId: 'show' }, true);
      expect(backend.calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
        positionSeconds: 2400,
        seriesId: 's1',
        masterId: 'show',
        episodeNumber: 1,
      });
      expect(isEpisodeWatched(stores.progress.getState(), e1!)).toBe(true);
      expect(allEpisodesWatched(stores.progress.getState(), series)).toBe(false);
      await setEpisodeWatched(stores.progress, e2!, { title: 'Show', masterId: 'show' }, true);
      expect(allEpisodesWatched(stores.progress.getState(), series)).toBe(true);
      await setEpisodeWatched(stores.progress, e1!, { title: 'Show' }, false);
      expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname)).toEqual([
        '/api/profiles/p1/progress/episode/e1',
      ]);
      expect(allEpisodesWatched(stores.progress.getState(), series)).toBe(false);
    });

    it('marks a whole series (all versions) and keeps the note for the cover tag', async () => {
      const { backend, stores, api } = await setup([]);
      backend.on('GET', '/api/library/series/show', {
        body: { id: 'show', title: 'Show', posterUrl: null, rating: null, bestQuality: null, year: 2020, variants: [variant('s1')] },
      });
      backend.on('GET', '/api/catalog/series/s1', { body: seriesBody('s1', ['e1', 'e2']) });
      const deps = { api, library: stores.library, progress: stores.progress, profilePrefs: stores.profilePrefs };

      await setSeriesWatched(deps, 'show', true);
      expect(
        backend.calls
          .filter((c) => c.method === 'PUT')
          .map((c) => c.url.pathname)
          .sort(),
      ).toEqual(['/api/profiles/p1/progress/episode/e1', '/api/profiles/p1/progress/episode/e2']);
      expect(isSeriesWatched(stores.profilePrefs.getState().prefs, 'p1', 'show')).toBe(true);

      await setSeriesWatched(deps, 'show', false);
      expect(backend.calls.filter((c) => c.method === 'DELETE')).toHaveLength(2);
      expect(isSeriesWatched(stores.profilePrefs.getState().prefs, 'p1', 'show')).toBe(false);
    });
  });
});

describe('what a series Play button starts (issue #133)', () => {
  const episode = (id: string, season: number, number: number) =>
    ({
      id,
      seasonNumber: season,
      episodeNumber: number,
      title: `Episode ${number}`,
      seriesId: 's1',
      versions: [{ seriesId: 's1', label: '', episode: { id } }],
    }) as unknown as MergedEpisode;
  const series = (count: number) =>
    ({
      seasons: [{ number: 1, episodes: Array.from({ length: count }, (_, i) => episode(`e${i + 1}`, 1, i + 1)) }],
    }) as unknown as Pick<MergedSeries, 'seasons'>;
  const seen = (id: string, number: number, position: number): ProgressDto =>
    entry(id, position, { kind: 'episode', seriesId: 's1', seasonNumber: 1, episodeNumber: number, durationSeconds: 2400 });
  const items = (...list: ProgressDto[]) => ({ items: { status: 'success' as const, data: list, error: null, updatedAt: 0 } });

  it('resumes the episode in progress', () => {
    const progress = seen('e2', 2, 600);
    const start = seriesStart(items(progress), series(4), progress);
    expect(start).toEqual({ kind: 'resume', progress });
    expect(seriesStartLabel(start)).toBe('Resume S1:E2');
  });

  it('once the last one watched is finished, plays the next episode not watched yet, a new one too', () => {
    const progress = seen('e4', 4, 2390);
    expect(seriesStart(items(progress), series(4), progress)).toEqual({ kind: 'resume', progress });
    // Episode 5 came out: Play starts it.
    const start = seriesStart(items(progress), series(5), progress);
    expect(start).toMatchObject({ kind: 'next', episode: { id: 'e5' } });
    expect(seriesStartLabel(start)).toBe('Play S1:E5');
  });

  it('skips episodes already watched after the last one', () => {
    const last = seen('e2', 2, 2390);
    const start = seriesStart(items(last, seen('e3', 3, 2390)), series(4), last);
    expect(start).toMatchObject({ kind: 'next', episode: { id: 'e4' } });
  });

  it('without progress, the first episode; without episodes, nothing', () => {
    const start = seriesStart(items(), series(3), null);
    expect(start).toMatchObject({ kind: 'first', episode: { id: 'e1' } });
    expect(seriesStartLabel(start)).toBe('Play');
    expect(seriesStart(items(), null, null)).toBeNull();
  });
});
