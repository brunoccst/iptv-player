import { describe, expect, it, vi } from 'vitest';
import { CREDENTIALS_KEY, profilesKey, progressKey, watchlistKey } from '../direct/directApiClient';
import { noteRemoval, readRemovals, removalsKey } from '../direct/removals';
import { titleRulesKey } from '../direct/titleRules';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import { createMemoryStorage } from '../stores/storage';
import { PROFILE_PREFS_KEY } from '../stores/profilePrefsStore';
import { pinStorageKey } from '../stores/pinStore';
import { answerSync, createAutoSync, syncWithTv } from './autoSync';
import { mergeMedia, newerCredentials, type MediaState } from './pairing';
import { openRemoteRequest, REMOTE_PORTS, type PairedPhone, type PairedTv } from './remote';

const key = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => (i * 5) % 256)));
const pairedPhone: PairedPhone = { phoneId: 'phone-1', key, pairedAt: '2026-10-01T10:00:00Z' };
const tv: PairedTv = { ...pairedPhone, tvId: 'tv-1', tvName: 'Living room TV', host: '192.168.1.20', port: REMOTE_PORTS[0]! };
const account = { id: 'acc-1', username: 'demo' };
const now = new Date('2026-10-17T12:00:00Z');
const profile = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  avatarKey: null,
  isKids: false,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});
const progress = (itemId: string, updatedAt: string) => ({
  kind: 'movie',
  itemId,
  title: itemId,
  positionSeconds: 60,
  durationSeconds: 5000,
  updatedAt,
});
const listed = (masterId: string, addedAt: string) => ({
  section: 'movies' as const,
  masterId,
  title: masterId,
  year: null,
  posterUrl: null,
  addedAt,
});

function device(
  profiles: object[],
  data: Record<string, unknown>,
  activeProfileId: string | null = 'p1',
): { secure: ReturnType<typeof createMemoryStorage>; data: ReturnType<typeof createMemoryStorage> } {
  return {
    secure: createMemoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'direct-x', account, profiles, activeProfileId }) }),
    data: createMemoryStorage({
      [profilesKey('acc-1')]: JSON.stringify(profiles),
      ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)])),
    }),
  };
}

/** The TV's remote server: opens the command and answers the sync. */
const via = (tvDevice: ReturnType<typeof device>, changes: boolean[] = []) =>
  (async (_url: string, init?: RequestInit) => {
    const opened = openRemoteRequest([pairedPhone], String(init?.body), now);
    if (!opened) return new Response('forbidden', { status: 403 });
    if (opened.command.type !== 'sync') return new Response(opened.reply({ ok: false, error: 'bad-request' }));
    const { reply, changed } = await answerSync(tvDevice, opened.command, now);
    changes.push(changed);
    return new Response(opened.reply(reply), { status: 200 });
  }) as typeof fetch;

const read = (d: ReturnType<typeof device>, k: string) => JSON.parse(d.data.data.get(k) ?? 'null');

describe('automatic sync with the paired TV (issue #227)', () => {
  it('both devices end up with the newest progress and both lists', async () => {
    const phone = device([profile('p1', 'demo')], {
      [progressKey('p1')]: [progress('a', '2026-10-16T10:00:00Z'), progress('b', '2026-10-10T10:00:00Z')],
      [watchlistKey('p1')]: [listed('m1', '2026-10-01T00:00:00Z')],
    });
    const tvDevice = device([profile('p1', 'demo')], {
      [progressKey('p1')]: [progress('b', '2026-10-15T10:00:00Z')],
      [watchlistKey('p1')]: [listed('m2', '2026-10-02T00:00:00Z')],
    });
    const changes: boolean[] = [];
    await expect(syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice, changes), now: () => now })).resolves.toEqual({
      host: tv.host,
      port: tv.port,
      changed: true,
      signIn: false,
    });
    expect(changes).toEqual([true]);
    for (const d of [phone, tvDevice]) {
      expect(read(d, progressKey('p1')).map((p: { itemId: string; updatedAt: string }) => `${p.itemId}@${p.updatedAt}`)).toEqual([
        'a@2026-10-16T10:00:00Z',
        'b@2026-10-15T10:00:00Z',
      ]);
      expect(read(d, watchlistKey('p1')).map((w: { masterId: string }) => w.masterId)).toEqual(['m2', 'm1']);
    }
    // Nothing new the second time: neither side changes.
    await expect(syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice, changes), now: () => now })).resolves.toMatchObject({
      changed: false,
    });
    expect(changes).toEqual([true, false]);
  });

  it('a title taken off My List or Continue watching on one device stays off on both', async () => {
    const phone = device([profile('p1', 'demo')], {
      [progressKey('p1')]: [],
      [watchlistKey('p1')]: [],
    });
    await noteRemoval(phone.data, 'acc-1', { list: 'watchlist', profileId: 'p1', key: 'movies:m1' }, new Date('2026-10-16T00:00:00Z'));
    await noteRemoval(phone.data, 'acc-1', { list: 'progress', profileId: 'p1', key: 'movie:a' }, new Date('2026-10-16T00:00:00Z'));
    const tvDevice = device([profile('p1', 'demo')], {
      [progressKey('p1')]: [progress('a', '2026-10-10T10:00:00Z')],
      [watchlistKey('p1')]: [listed('m1', '2026-10-01T00:00:00Z'), listed('m3', '2026-10-16T08:00:00Z')],
    });
    await syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice), now: () => now });
    for (const d of [phone, tvDevice]) {
      expect(read(d, progressKey('p1'))).toEqual([]);
      // m3 was added on the TV after the removal of m1: it stays.
      expect(read(d, watchlistKey('p1')).map((w: { masterId: string }) => w.masterId)).toEqual(['m3']);
      expect(readRemovals(d.data.data.get(removalsKey('acc-1'))).watchlist.p1).toEqual({ 'movies:m1': '2026-10-16T00:00:00.000Z' });
    }
  });

  it("each device's title splits and merges reach the other, the later change winning (issue #267)", async () => {
    const rule = (src: string, at: string, removed?: boolean) => ({
      kind: 'movie',
      rule: 'merge',
      src,
      dst: 'kZ|',
      at,
      ...(removed ? { removed } : {}),
    });
    const phone = device([profile('p1', 'demo')], {
      [titleRulesKey('acc-1')]: [rule('kA|', '2026-10-16T00:00:00.000Z'), rule('kB|', '2026-10-16T00:00:00.000Z', true)],
    });
    const tvDevice = device([profile('p1', 'demo')], {
      [titleRulesKey('acc-1')]: [rule('kB|', '2026-10-10T00:00:00.000Z'), rule('kC|', '2026-10-12T00:00:00.000Z')],
    });
    await syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice), now: () => now });
    for (const d of [phone, tvDevice])
      expect(read(d, titleRulesKey('acc-1'))).toEqual([
        rule('kA|', '2026-10-16T00:00:00.000Z'),
        rule('kB|', '2026-10-16T00:00:00.000Z', true),
        rule('kC|', '2026-10-12T00:00:00.000Z'),
      ]);
  });

  it('profile preferences sync too: each the one changed later (issue #268)', async () => {
    const phone = device([profile('p1', 'demo')], {
      [PROFILE_PREFS_KEY]: { p1: { appLanguage: 'de', languages: ['GER'], changedAt: { appLanguage: '2026-10-16T00:00:00.000Z' } } },
    });
    const tvDevice = device([profile('p1', 'demo')], {
      [PROFILE_PREFS_KEY]: {
        p1: { appLanguage: 'pt-BR', languages: ['POR'], changedAt: { languages: '2026-10-15T00:00:00.000Z' } },
        // Another account's profile on the TV stays as it is.
        other: { appLanguage: 'sh-BA' },
      },
    });
    const changes: boolean[] = [];
    await expect(syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice, changes), now: () => now })).resolves.toMatchObject({
      changed: true,
      signIn: false,
    });
    const p1 = {
      appLanguage: 'de',
      languages: ['POR'],
      changedAt: { appLanguage: '2026-10-16T00:00:00.000Z', languages: '2026-10-15T00:00:00.000Z' },
    };
    expect(read(phone, PROFILE_PREFS_KEY).p1).toEqual(p1);
    expect(read(tvDevice, PROFILE_PREFS_KEY)).toEqual({ p1, other: { appLanguage: 'sh-BA' } });
    expect(changes).toEqual([true]);
    // In step: the next sync changes nothing.
    await expect(syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice, changes), now: () => now })).resolves.toMatchObject({
      changed: false,
    });
    expect(changes).toEqual([true, false]);
  });

  it('a new server or password reaches the other device, the later change winning (DECISIONS.md#d-228)', async () => {
    const signIn = (serverUrl: string, password: string, changedAt?: string) =>
      JSON.stringify({ serverUrl, username: 'demo', password, account, ...(changedAt ? { changedAt } : {}) });
    const phone = device([profile('p1', 'demo')], {});
    const tvDevice = device([profile('p1', 'demo')], {});
    phone.secure.data.set(CREDENTIALS_KEY, signIn('http://new.test/', 'new', '2026-10-17T11:00:00Z'));
    tvDevice.secure.data.set(CREDENTIALS_KEY, signIn('http://old.test/', 'old', '2026-10-01T00:00:00Z'));
    const first = await syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice), now: () => now });
    expect(JSON.parse(tvDevice.secure.data.get(CREDENTIALS_KEY)!)).toMatchObject({ serverUrl: 'http://new.test/', password: 'new' });
    expect(first.signIn).toBe(false);

    // Changed later on the TV: the phone takes it and signs in with it again.
    tvDevice.secure.data.set(CREDENTIALS_KEY, signIn('http://tv.test/', 'tv', '2026-10-17T11:30:00Z'));
    const second = await syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice), now: () => now });
    expect(second.signIn).toBe(true);
    expect(JSON.parse(phone.secure.data.get(CREDENTIALS_KEY)!)).toMatchObject({ serverUrl: 'http://tv.test/' });

    // Undated (saved before) never replaces a sign-in, nor does another account's.
    expect(newerCredentials(signIn('http://a/', 'a'), signIn('http://b/', 'b', '2026-10-01'), 'acc-1')).toBeNull();
    expect(newerCredentials(signIn('http://a/', 'a', '2026-10-02'), signIn('http://b/', 'b'), 'acc-1')).not.toBeNull();
    expect(newerCredentials(signIn('http://a/', 'a', '2026-10-02'), null, 'acc-2')).toBeNull();
  });

  it('a series marked not watched stays that way on both; recent channels sort by when they were watched (DECISIONS.md#d-229)', async () => {
    const channel = (id: string) => ({ id, name: id, logoUrl: null, categoryId: null });
    const phone = device([profile('p1', 'demo')], {
      [PROFILE_PREFS_KEY]: {
        p1: {
          watchedSeries: ['s2'],
          recentChannels: [channel('a'), channel('b')],
          listChangedAt: {
            watchedSeries: { s1: '2026-10-17T11:00:00.000Z', s2: '2026-10-10T00:00:00.000Z' },
            recentChannels: { a: '2026-10-16T00:00:00.000Z', b: '2026-10-14T00:00:00.000Z' },
          },
        },
      },
    });
    const tvDevice = device([profile('p1', 'demo')], {
      [PROFILE_PREFS_KEY]: {
        p1: {
          watchedSeries: ['s1', 's3'],
          recentChannels: [channel('c'), channel('a')],
          listChangedAt: {
            watchedSeries: { s1: '2026-10-12T00:00:00.000Z' },
            recentChannels: { c: '2026-10-15T00:00:00.000Z', a: '2026-10-13T00:00:00.000Z' },
          },
        },
      },
    });
    await syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice), now: () => now });
    for (const side of [phone, tvDevice]) {
      const p1 = read(side, PROFILE_PREFS_KEY).p1;
      // s1 was marked not watched on the phone after the TV marked it; s3 (undated) is joined.
      expect([...p1.watchedSeries].sort()).toEqual(['s2', 's3']);
      expect(p1.recentChannels.map((c: { id: string }) => c.id)).toEqual(['a', 'c', 'b']);
    }
  });

  it('a parental PIN set or removed later reaches the other device (DECISIONS.md#d-229)', async () => {
    const phone = device([profile('p1', 'demo')], {});
    const tvDevice = device([profile('p1', 'demo')], {});
    const pinKey = pinStorageKey('acc-1');
    tvDevice.secure.data.set(pinKey, JSON.stringify({ salt: 's', hash: 'old', changedAt: '2026-10-01T00:00:00.000Z' }));
    const removed = JSON.stringify({ changedAt: '2026-10-17T11:00:00.000Z' });
    phone.secure.data.set(pinKey, removed);
    const changes: boolean[] = [];
    await syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice, changes), now: () => now });
    expect(tvDevice.secure.data.get(pinKey)).toBe(removed);
    expect(changes).toEqual([true]);

    const set = JSON.stringify({ salt: 's', hash: 'new', changedAt: '2026-10-17T11:30:00.000Z' });
    tvDevice.secure.data.set(pinKey, set);
    await expect(syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice), now: () => now })).resolves.toMatchObject({ changed: true });
    expect(phone.secure.data.get(pinKey)).toBe(set);
  });

  it('a title added again after its removal comes back', () => {
    const removals = { profiles: {}, progress: {}, watchlist: { p1: { 'movies:m1': '2026-10-10T00:00:00Z' } } };
    const local: MediaState = { profiles: [profile('p1', 'demo')], progress: {}, watchlist: { p1: [] }, removals };
    const incoming: MediaState = {
      profiles: [profile('p1', 'demo')],
      progress: {},
      watchlist: { p1: [listed('m1', '2026-10-12T00:00:00Z')] },
    };
    expect(mergeMedia(incoming, local, now).merged.watchlist.p1).toHaveLength(1);
  });

  it('a profile deleted on the TV is deleted on the phone too, and the phone closes it', async () => {
    const phone = device(
      [profile('p1', 'demo'), profile('p2', 'Guest')],
      {
        [progressKey('p2')]: [progress('a', '2026-10-10T10:00:00Z')],
        [watchlistKey('p2')]: [],
        [PROFILE_PREFS_KEY]: { p2: { languages: ['ENG'] } },
      },
      'p2',
    );
    const tvDevice = device([profile('p1', 'demo')], {});
    await noteRemoval(tvDevice.data, 'acc-1', { profile: 'p2' }, new Date('2026-10-15T00:00:00Z'));
    await syncWithTv(phone, tv, 'acc-1', { fetch: via(tvDevice), now: () => now });
    expect(read(phone, profilesKey('acc-1')).map((p: { id: string }) => p.id)).toEqual(['p1']);
    expect(phone.data.data.has(progressKey('p2'))).toBe(false);
    expect(read(phone, PROFILE_PREFS_KEY)).toEqual({});
    expect(JSON.parse(phone.secure.data.get(SESSION_STORAGE_KEY)!)).toMatchObject({ activeProfileId: null, profiles: [{ id: 'p1' }] });
  });

  it('a profile edited later on the TV keeps the TV name', () => {
    const incoming: MediaState = { profiles: [profile('p1', 'demo')], progress: {}, watchlist: {} };
    const local: MediaState = { profiles: [profile('p1', 'Dad', { updatedAt: '2026-10-16T00:00:00Z' })], progress: {}, watchlist: {} };
    expect(mergeMedia(incoming, local, now).merged.profiles).toMatchObject([{ id: 'p1', name: 'Dad' }]);
    expect(mergeMedia(local, incoming, now).merged.profiles).toMatchObject([{ id: 'p1', name: 'Dad' }]);
  });

  it('never removes the last profile', () => {
    const removals = { profiles: { p1: '2026-10-16T00:00:00Z' }, progress: {}, watchlist: {} };
    const state: MediaState = { profiles: [profile('p1', 'demo')], progress: {}, watchlist: {}, removals };
    expect(mergeMedia(state, state, now).merged.profiles).toHaveLength(1);
  });

  it('a TV signed in to another account refuses', async () => {
    const phone = device([profile('p1', 'demo')], {});
    const other = device([profile('p1', 'demo')], {});
    other.secure.data.set(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', account: { id: 'acc-2' }, profiles: [] }));
    await expect(syncWithTv(phone, tv, 'acc-1', { fetch: via(other), now: () => now })).rejects.toMatchObject({ reason: 'other-account' });
  });

  it('syncs at most once a minute and never twice at a time', async () => {
    let clock = 0;
    let release = () => {};
    const sync = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const auto = createAutoSync(sync, () => clock);
    const first = auto.request();
    expect(auto.request()).toBe(first);
    release();
    await first;
    clock = 30_000;
    await auto.request();
    expect(sync).toHaveBeenCalledTimes(1);
    clock = 61_000;
    const third = auto.request();
    release();
    await third;
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
