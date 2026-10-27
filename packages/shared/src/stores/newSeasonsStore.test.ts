import { describe, expect, it } from 'vitest';
import type { ApiClient } from '../api/apiClient';
import type { MasterDetails, ProgressDto, SeriesDetails, VariantInfo } from '../api/types';
import { createNewSeasonsStore, newSeasonLine, versionInLanguages, watchedSeriesIds } from './newSeasonsStore';
import { createProfilePrefsStore, type ProfilePrefs } from './profilePrefsStore';
import { createProgressStore } from './progressStore';
import { createMemoryStorage } from './storage';

const variant = (streamId: string, audioLanguages: string[] = [], categoryId: string | null = null): VariantInfo => ({
  streamId,
  label: streamId,
  audioLanguages,
  subtitleLanguages: [],
  audioTag: null,
  categoryId,
  containerExtension: null,
  isHdr: false,
  quality: null,
  rawTitle: streamId,
  source: null,
});

const seriesWith = (seasons: number[]): SeriesDetails =>
  ({
    seasons: seasons.map((number) => ({ number, name: `S${number}`, coverUrl: null, episodes: [{ id: `e${number}` }] })),
  }) as unknown as SeriesDetails;

const episode = (masterId: string, seasonNumber: number): ProgressDto => ({
  itemId: `${masterId}-${seasonNumber}`,
  kind: 'episode',
  masterId,
  seriesId: null,
  seasonNumber,
  episodeNumber: 1,
  positionSeconds: 100,
  durationSeconds: 1000,
  containerExtension: null,
  posterUrl: null,
  title: masterId,
  updatedAt: '2026-10-01T00:00:00Z',
});

function setup({
  seasons,
  progress = [],
  prefs = {},
}: {
  seasons: Record<string, number[]>;
  progress?: ProgressDto[];
  prefs?: ProfilePrefs;
}) {
  const masters: Record<string, MasterDetails> = {
    s1: {
      id: 's1',
      title: 'Dark',
      year: 2017,
      posterUrl: null,
      rating: null,
      bestQuality: null,
      variants: [variant('en', ['ENG']), variant('de', ['GER'])],
    },
    s2: { id: 's2', title: 'Lost', year: 2004, posterUrl: null, rating: null, bestQuality: null, variants: [variant('lost')] },
  };
  const api = {
    library: { get: async (_section: string, id: string) => masters[id]! },
    catalog: { seriesDetails: async (id: string) => seriesWith(seasons[id] ?? []), categories: async () => [] },
    progress: { list: async () => progress },
  } as unknown as ApiClient;
  const storage = createMemoryStorage({ 'settings.profiles': JSON.stringify({ p1: prefs }) });
  const profilePrefs = createProfilePrefsStore(storage);
  const store = createNewSeasonsStore({ api, progress: createProgressStore({ api }), profilePrefs });
  return { store, profilePrefs, seen: () => profilePrefs.getState().prefs.p1?.seasonsSeen };
}

describe('new seasons of watched series (DECISIONS.md#d-234)', () => {
  it('only notes a series the first time, then announces a newer season once', async () => {
    const first = setup({ seasons: { en: [1, 2] }, progress: [episode('s1', 1)] });
    await first.store.getState().check('p1');
    expect(first.store.getState().items).toEqual([]);
    expect(first.seen()).toEqual({ s1: 2 });

    const later = setup({ seasons: { en: [1, 2, 3] }, progress: [episode('s1', 1)], prefs: { seasonsSeen: { s1: 2 } } });
    await later.store.getState().check('p1');
    expect(later.store.getState().items).toMatchObject([{ masterId: 's1', title: 'Dark', season: 3, seen: 2 }]);
    await later.store.getState().dismiss();
    expect(later.store.getState().items).toEqual([]);
    expect(later.seen()).toEqual({ s1: 3 });
  });

  it('counts series marked watched, and ignores a season the profile already watches', async () => {
    const marked = setup({ seasons: { lost: [1, 2] }, prefs: { watchedSeries: ['s2'], seasonsSeen: { s2: 1 } } });
    await marked.store.getState().check('p1');
    expect(marked.store.getState().items.map((item) => item.masterId)).toEqual(['s2']);

    const started = setup({ seasons: { en: [1, 2, 3] }, progress: [episode('s1', 3)], prefs: { seasonsSeen: { s1: 2 } } });
    await started.store.getState().check('p1');
    expect(started.store.getState().items).toEqual([]);
    expect(started.seen()).toEqual({ s1: 3 });
  });

  it('leaves out a new season only in a language the profile did not choose', async () => {
    const german = { seasons: { en: [1, 2], de: [1, 2, 3] }, progress: [episode('s1', 1)] };
    const en = setup({ ...german, prefs: { languages: ['ENG'], seasonsSeen: { s1: 2 } } });
    await en.store.getState().check('p1');
    expect(en.store.getState().items).toEqual([]);
    const all = setup({ ...german, prefs: { seasonsSeen: { s1: 2 } } });
    await all.store.getState().check('p1');
    expect(all.store.getState().items.map((item) => item.season)).toEqual([3]);
  });

  it('reads languages from the version, else from its category', () => {
    const names = new Map([
      ['c-de', 'DE | Serien'],
      ['c-x', 'Netflix'],
    ]);
    expect(versionInLanguages(variant('a', ['ENG']), ['ENG'], names)).toBe(true);
    expect(versionInLanguages(variant('a', ['GER']), ['ENG'], names)).toBe(false);
    expect(versionInLanguages(variant('a', [], 'c-de'), ['ENG'], names)).toBe(false);
    expect(versionInLanguages(variant('a', [], 'c-x'), ['ENG'], names)).toBe(true);
    expect(versionInLanguages(variant('a', ['GER']), [], names)).toBe(true);
  });

  it('lists each watched series once and words several seasons', () => {
    expect(watchedSeriesIds([episode('s1', 1), episode('s1', 2), { ...episode('m', 0), kind: 'movie' }], ['s1', 's2'])).toEqual([
      's1',
      's2',
    ]);
    expect(newSeasonLine({ season: 3, seen: 2 })).toBe('Season 3 is out');
    expect(newSeasonLine({ season: 5, seen: 2 })).toBe('Seasons 3 to 5 are out');
  });
});
