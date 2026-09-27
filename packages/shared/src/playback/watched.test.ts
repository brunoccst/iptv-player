import { describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import type { ProgressDto } from '../api/types';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { createMemoryStorage } from '../stores/storage';
import {
  cardMenuItems,
  isMovieWatched,
  isWatched,
  markEntryWatched,
  removeFromContinueWatching,
  setMovieWatched,
  watchedRequest,
} from './watched';

const config = { appName: 'T', appSlug: 't', apiBaseUrl: 'http://api.test' };
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
    backend.on('PUT', `/api/profiles/p1/progress/episode/${id}`, ({ body }) => ({ body: { ...entry(id, 0), ...(body as object) } }));
    backend.on('DELETE', `/api/profiles/p1/progress/movie/${id}`, { status: 204 });
    backend.on('DELETE', `/api/profiles/p1/progress/episode/${id}`, { status: 204 });
  }
  const { stores } = createAppContext({ config, storage: createMemoryStorage(), fetch: backend.fetch });
  await stores.session.getState().login({ serverUrl: 's', username: 'u', password: 'p' });
  stores.session.getState().selectProfile('p1');
  await stores.progress.getState().load('p1');
  return { backend, stores };
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

  it('card menus: continue watching, movies (watched or not), series', () => {
    const labels = (items: { label: string }[]) => items.map((item) => item.label);
    expect(labels(cardMenuItems({ kind: 'continue', entry: entry('e1', 5, { kind: 'episode', masterId: 'show' }) }))).toEqual([
      'Go to details',
      'Mark episode as watched',
      'Remove from Continue Watching',
    ]);
    expect(labels(cardMenuItems({ kind: 'continue', entry: entry('e1', 5, { kind: 'episode', masterId: null }) }))).toEqual([
      'Mark episode as watched',
      'Remove from Continue Watching',
    ]);
    expect(labels(cardMenuItems({ kind: 'movie', watched: false }))).toEqual(['Go to details', 'Mark as watched']);
    expect(labels(cardMenuItems({ kind: 'movie', watched: true }))).toEqual(['Go to details', 'Mark as not watched']);
    expect(labels(cardMenuItems({ kind: 'series' }))).toEqual(['Go to details']);
  });
});
