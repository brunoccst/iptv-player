import { describe, expect, it } from 'vitest';
import { CREDENTIALS_KEY, profilesKey, progressKey, watchlistKey } from '../direct/directApiClient';
import { CONNECTION_STORAGE_KEY } from '../stores/connectionStore';
import { pinStorageKey } from '../stores/pinStore';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import { createMemoryStorage } from '../stores/storage';
import { acceptPairing, pairingQrText, parsePairingQr, sendPairing, type PairingOffer } from './pairing';

const KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i * 7)));
const offer: PairingOffer = { host: '192.168.1.20', port: 38123, key: KEY };
const account = { id: 'acc-1', username: 'demo' };
const progress = (itemId: string, updatedAt: string, positionSeconds = 100) => ({
  kind: 'movie',
  itemId,
  title: `Movie ${itemId}`,
  positionSeconds,
  durationSeconds: 5000,
  updatedAt,
});
const listed = (masterId: string, addedAt: string) => ({ section: 'movies', masterId, title: masterId, addedAt });

function phone() {
  const profiles = [
    { id: 'phone-p1', name: 'demo', avatarKey: null, isKids: false },
    { id: 'phone-kids', name: 'Kids', avatarKey: null, isKids: true },
  ];
  return {
    secure: createMemoryStorage({
      [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'direct-x', account, profiles, activeProfileId: 'phone-p1' }),
      [CONNECTION_STORAGE_KEY]: JSON.stringify({ mode: 'direct', serverUrl: '' }),
      [CREDENTIALS_KEY]: JSON.stringify({ serverUrl: 'http://panel/', username: 'demo', password: 'secret' }),
      [pinStorageKey('acc-1')]: '{"salt":"s","hash":"h"}',
    }),
    data: createMemoryStorage({
      [profilesKey('acc-1')]: JSON.stringify(profiles),
      [progressKey('phone-p1')]: JSON.stringify([progress('1', '2026-09-20T10:00:00Z'), progress('2', '2026-09-25T10:00:00Z', 900)]),
      [watchlistKey('phone-p1')]: JSON.stringify([listed('m1', '2026-09-10T00:00:00Z')]),
      [watchlistKey('phone-kids')]: JSON.stringify([listed('cartoon', '2026-09-11T00:00:00Z')]),
      'settings.playback': '{"audioDecoder":"ffmpeg"}',
    }),
  };
}

/** Wires the phone's request straight into the TV's handler. */
const via = (tv: { secure: ReturnType<typeof createMemoryStorage>; data: ReturnType<typeof createMemoryStorage> }, key = KEY) =>
  (async (_url: string, init?: RequestInit) => {
    const { status, body } = await acceptPairing(tv, key, String(init?.body));
    return new Response(body, { status });
  }) as typeof fetch;

describe('phone-to-TV pairing (D-060)', () => {
  it('the QR text carries address and key', () => {
    const text = pairingQrText(offer);
    expect(text).toMatch(/^IPTVPAIR:1:192\.168\.1\.20:38123:[A-Za-z0-9_-]{43}$/);
    expect(parsePairingQr(text)).toEqual(offer);
    expect(parsePairingQr('https://example.com')).toBeNull();
  });

  it('a signed-out TV signs in with the phone account, its PIN and media, but not its device settings', async () => {
    const tv = { secure: createMemoryStorage(), data: createMemoryStorage({ 'settings.playback': '{"audioDecoder":"device"}' }) };
    const result = await sendPairing(phone(), offer, { fetch: via(tv) });
    expect(result).toEqual({ ok: true, mode: 'login', accountName: 'demo' });

    const session = JSON.parse(tv.secure.data.get(SESSION_STORAGE_KEY)!);
    expect(session).toMatchObject({ token: 'direct-x', account, activeProfileId: null });
    expect(tv.secure.data.get(CREDENTIALS_KEY)).toContain('secret');
    expect(tv.secure.data.get(CONNECTION_STORAGE_KEY)).toContain('direct');
    expect(tv.secure.data.get(pinStorageKey('acc-1'))).toBe('{"salt":"s","hash":"h"}');
    expect(JSON.parse(tv.data.data.get(watchlistKey('phone-kids'))!)).toHaveLength(1);
    expect(tv.data.data.get('settings.playback')).toBe('{"audioDecoder":"device"}');
  });

  it('the same account on both merges profiles by name, the newest progress and both lists, on both devices', async () => {
    const tvProfiles = [
      { id: 'tv-p1', name: 'Demo ', avatarKey: null, isKids: false, createdAt: '2026-09-01T00:00:00Z' },
      { id: 'tv-guest', name: 'Guest', avatarKey: null, isKids: false },
    ];
    const tv = {
      secure: createMemoryStorage({
        [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'direct-tv', account, profiles: tvProfiles, activeProfileId: 'tv-p1' }),
      }),
      data: createMemoryStorage({
        [profilesKey('acc-1')]: JSON.stringify(tvProfiles),
        [progressKey('tv-p1')]: JSON.stringify([progress('1', '2026-09-24T10:00:00Z', 2000), progress('3', '2026-09-01T10:00:00Z')]),
        [watchlistKey('tv-p1')]: JSON.stringify([listed('m1', '2026-09-01T00:00:00Z'), listed('m2', '2026-09-15T00:00:00Z')]),
        [watchlistKey('tv-guest')]: JSON.stringify([listed('g1', '2026-09-02T00:00:00Z')]),
      }),
    };
    const mobile = phone();
    const result = await sendPairing(mobile, offer, { fetch: via(tv) });
    expect(result).toMatchObject({ ok: true, mode: 'sync' });

    for (const device of [tv, mobile]) {
      const profiles = JSON.parse(device.data.data.get(profilesKey('acc-1'))!) as { id: string }[];
      expect(profiles.map((p) => p.id)).toEqual(['phone-p1', 'phone-kids', 'tv-guest']);
      const items = JSON.parse(device.data.data.get(progressKey('phone-p1'))!) as { itemId: string; positionSeconds: number }[];
      expect(items.map((i) => [i.itemId, i.positionSeconds])).toEqual([
        ['2', 900],
        ['1', 2000],
        ['3', 100],
      ]);
      const list = JSON.parse(device.data.data.get(watchlistKey('phone-p1'))!) as { masterId: string; addedAt: string }[];
      expect(list.map((i) => [i.masterId, i.addedAt])).toEqual([
        ['m2', '2026-09-15T00:00:00Z'],
        ['m1', '2026-09-01T00:00:00Z'],
      ]);
      expect(JSON.parse(device.data.data.get(watchlistKey('tv-guest'))!)).toHaveLength(1);
      expect(JSON.parse(device.secure.data.get(SESSION_STORAGE_KEY)!).profiles).toHaveLength(3);
    }
    // The TV keeps its own sign-in and moves its old profile id to the merged one.
    expect(JSON.parse(tv.secure.data.get(SESSION_STORAGE_KEY)!)).toMatchObject({ token: 'direct-tv', activeProfileId: 'phone-p1' });
    expect(tv.data.data.has(progressKey('tv-p1'))).toBe(false);
    expect(tv.data.data.has(watchlistKey('tv-p1'))).toBe(false);
    expect(tv.secure.data.get(pinStorageKey('acc-1'))).toBe('{"salt":"s","hash":"h"}');
    expect(mobile.data.data.get('settings.playback')).toBe('{"audioDecoder":"ffmpeg"}');
    expect(JSON.parse(mobile.secure.data.get(SESSION_STORAGE_KEY)!).activeProfileId).toBe('phone-p1');
  });

  it('refuses a TV signed in to another account, and requests sealed with another key', async () => {
    const other = {
      secure: createMemoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify({ token: 't', account: { id: 'acc-2' } }) }),
      data: createMemoryStorage(),
    };
    await expect(sendPairing(phone(), offer, { fetch: via(other) })).rejects.toMatchObject({ reason: 'other-account' });
    expect(other.data.data.size).toBe(0);

    const tv = { secure: createMemoryStorage(), data: createMemoryStorage() };
    const wrongKey = btoa(String.fromCharCode(...Array.from({ length: 32 }, () => 1)));
    await expect(sendPairing(phone(), offer, { fetch: via(tv, wrongKey) })).rejects.toMatchObject({ reason: 'wrong-code' });
    expect(tv.secure.data.size).toBe(0);

    const unreachable = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await expect(sendPairing(phone(), offer, { fetch: unreachable })).rejects.toMatchObject({ reason: 'unreachable' });
    await expect(sendPairing({ secure: createMemoryStorage() }, offer, { fetch: via(tv) })).rejects.toMatchObject({
      reason: 'not-signed-in',
    });
  });
});
