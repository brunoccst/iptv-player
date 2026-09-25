import { describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { CREDENTIALS_KEY, profilesKey, progressKey, watchlistKey } from '../direct/directApiClient';
import { CONNECTION_STORAGE_KEY } from '../stores/connectionStore';
import { pinStorageKey } from '../stores/pinStore';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import { createMemoryStorage } from '../stores/storage';
import { createFakePanel } from '../testing/fakePanel';
import { BACKUP_FORMAT, exportUserData, importUserData } from './userData';

const account = { id: 'acc-1' };
const profiles = [
  { id: 'p1', name: 'Zoë' },
  { id: 'p2', name: 'Kids 🐻' },
];

function device() {
  const secure = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'direct-x', account, profiles, activeProfileId: 'p1' }),
    [CONNECTION_STORAGE_KEY]: JSON.stringify({ mode: 'direct', serverUrl: '' }),
    [CREDENTIALS_KEY]: JSON.stringify({ serverUrl: 'http://panel/', username: 'demo', password: 'sécret' }),
    [pinStorageKey('acc-1')]: JSON.stringify({ salt: 's', hash: 'h' }),
    'unrelated.key': 'stays out',
  });
  const data = createMemoryStorage({
    [profilesKey('acc-1')]: JSON.stringify(profiles),
    [progressKey('p1')]: JSON.stringify([{ itemId: '55', positionSeconds: 100 }]),
    [watchlistKey('p2')]: JSON.stringify([{ section: 'series', masterId: 's1', title: 'Die Sendung mit der Maus' }]),
    'direct.library.v3.acc-1.movie': 'huge cache stays out',
  });
  return { secure, data };
}

describe('user-data backup (D-056)', () => {
  it('round-trips settings, credentials, PIN, profiles, progress and My List to another device', async () => {
    const old = device();
    const text = await exportUserData(old, 'correct horse');
    const file = JSON.parse(text) as { format: string; data: string };
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(text).not.toContain('demo');
    expect(text).not.toContain('sécret');

    const fresh = { secure: createMemoryStorage(), data: createMemoryStorage() };
    await importUserData(fresh, text, 'correct horse');
    for (const [key, value] of old.secure.data) if (key !== 'unrelated.key') expect(fresh.secure.data.get(key)).toBe(value);
    expect(fresh.secure.data.has('unrelated.key')).toBe(false);
    expect(fresh.data.data.get(progressKey('p1'))).toBe(old.data.data.get(progressKey('p1')));
    expect(fresh.data.data.get(watchlistKey('p2'))).toBe(old.data.data.get(watchlistKey('p2')));
    expect(fresh.data.data.get(profilesKey('acc-1'))).toBe(JSON.stringify(profiles));
    expect([...fresh.data.data.keys()].some((key) => key.startsWith('direct.library'))).toBe(false);
  });

  it('refuses short passwords, empty devices, wrong passwords and foreign files', async () => {
    await expect(exportUserData(device(), 'short')).rejects.toMatchObject({ reason: 'short-password' });
    await expect(exportUserData({ secure: createMemoryStorage() }, 'long enough')).rejects.toMatchObject({ reason: 'no-data' });
    const text = await exportUserData(device(), 'correct horse');
    const target = { secure: createMemoryStorage(), data: createMemoryStorage() };
    await expect(importUserData(target, text, 'wrong horse')).rejects.toMatchObject({ reason: 'wrong-password' });
    expect(target.secure.data.size).toBe(0);
    await expect(importUserData(target, '{"hello":1}', 'x')).rejects.toMatchObject({ reason: 'not-a-backup' });
    await expect(importUserData(target, text.replace('"version": 1', '"version": 99'), 'correct horse')).rejects.toMatchObject({
      reason: 'newer-version',
    });
  });

  it('works on the web, where one storage holds everything', async () => {
    const web = createMemoryStorage({
      [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles, activeProfileId: null }),
      [pinStorageKey('acc-1')]: '{"salt":"a","hash":"b"}',
    });
    const text = await exportUserData({ secure: web }, 'long enough');
    const restored = createMemoryStorage();
    await importUserData({ secure: restored }, text, 'long enough');
    expect(restored.data.get(pinStorageKey('acc-1'))).toBe('{"salt":"a","hash":"b"}');
  });

  it('a signed-out app restores a backup and is signed in after reload(), without a restart', async () => {
    const panel = createFakePanel();
    const config = { appName: 'Test', appSlug: 'test', apiBaseUrl: '' };
    const newDevice = () => {
      const storages = { secure: createMemoryStorage(), data: createMemoryStorage() };
      const app = createAppContext({ config, storage: storages.secure, fetch: panel.fetch, direct: { dataStorage: storages.data } });
      return { storages, app };
    };

    const old = newDevice();
    await old.app.stores.session.getState().login({ serverUrl: 'panel.test:8080', username: 'demo', password: 'demo' });
    const account = old.app.stores.session.getState().account;
    const text = await exportUserData(old.storages, 'correct horse');

    const fresh = newDevice();
    await fresh.app.stores.session.getState().restore();
    expect(fresh.app.stores.session.getState().status).toBe('anonymous');
    // The direct client has already looked for a login and cached "none".
    await expect(fresh.app.api.auth.me()).rejects.toMatchObject({ status: 401 });
    await importUserData(fresh.storages, text, 'correct horse');
    await fresh.app.reload();
    expect(fresh.app.stores.session.getState()).toMatchObject({ status: 'authenticated', account });
    expect(fresh.app.stores.session.getState().profiles).toEqual(old.app.stores.session.getState().profiles);
  });
});
