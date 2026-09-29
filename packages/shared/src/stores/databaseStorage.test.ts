import { describe, expect, it } from 'vitest';
import type { SqlDatabase } from '../direct/sqlLibrary';
import { createNodeSqlDatabase } from '../testing/nodeSqlDatabase';
import { exportUserData, importUserData } from '../backup/userData';
import { withUserDatabase } from './databaseStorage';
import { createMemoryStorage } from './storage';

const setup = (files: Record<string, string> = {}, secureFiles: Record<string, string> = {}, db: SqlDatabase = createNodeSqlDatabase()) => {
  const data = createMemoryStorage(files);
  const secure = createMemoryStorage(secureFiles);
  return { data, secure, db, storages: withUserDatabase({ secure, data }, db) };
};

describe('user data in the database (D-126)', () => {
  it('moves profiles, progress, My List, settings and the PIN into the database once, and leaves the rest alone', async () => {
    const { data, secure, db, storages } = setup(
      {
        'direct.profiles.a': '[1]',
        'direct.progress.p': '[2]',
        'direct.watchlist.p': '[3]',
        'settings.playback': '{}',
        'update.skipped': 'x',
      },
      { 'pin.a': 'hash', session: 's', 'direct.credentials': 'c' },
    );
    for (const key of ['direct.profiles.a', 'direct.progress.p', 'direct.watchlist.p', 'settings.playback'])
      expect(await storages.data.getItem(key)).toBe(expectedOf(key));
    expect(await storages.secure.getItem('pin.a')).toBe('hash');

    // Out of the files, into the database; the sign-in, the session and other files stay where they were.
    expect([...data.data.keys()]).toEqual(['update.skipped']);
    expect([...secure.data.keys()].sort()).toEqual(['direct.credentials', 'session']);
    expect(await storages.data.getItem('update.skipped')).toBe('x');
    const rows = await db.query('SELECT key FROM user_data ORDER BY key');
    expect(rows.map((row) => row[0])).toEqual([
      'direct.profiles.a',
      'direct.progress.p',
      'direct.watchlist.p',
      'pin.a',
      'settings.playback',
    ]);

    // A second app start reads the database.
    const again = withUserDatabase({ secure, data }, db);
    expect(await again.data.getItem('direct.progress.p')).toBe('[2]');
  });

  it('writes and removes in the database, and the old file goes', async () => {
    const { data, storages } = setup({ 'direct.progress.p': 'old' });
    await storages.data.setItem('direct.progress.p', 'new');
    expect(data.data.has('direct.progress.p')).toBe(false);
    expect(await storages.data.getItem('direct.progress.p')).toBe('new');
    await storages.data.removeItem('direct.progress.p');
    expect(await storages.data.getItem('direct.progress.p')).toBeNull();
  });

  it('a read and a write at once keep the write', async () => {
    const { storages } = setup({ 'settings.profiles': 'old' });
    const [read] = await Promise.all([storages.data.getItem('settings.profiles'), storages.data.setItem('settings.profiles', 'new')]);
    expect(read).toBe('old');
    expect(await storages.data.getItem('settings.profiles')).toBe('new');
  });

  it('uses the files when the database fails', async () => {
    const broken: SqlDatabase = {
      run: () => Promise.reject(new Error('disk I/O error')),
      query: () => Promise.reject(new Error('disk I/O error')),
    };
    const { data, storages } = setup({ 'settings.profiles': 'kept' }, {}, broken);
    expect(await storages.data.getItem('settings.profiles')).toBe('kept');
    await storages.data.setItem('settings.profiles', 'written');
    expect(data.data.get('settings.profiles')).toBe('written');
  });

  it('a backup reads the database and restores into it, PIN included', async () => {
    const session = JSON.stringify({ account: { id: 'a' }, profiles: [{ id: 'p' }] });
    const from = setup({ 'direct.profiles.a': '[{"id":"p"}]', 'direct.progress.p': '[2]' }, { session, 'pin.a': 'hash' });
    const text = await exportUserData({ ...from.storages, settingsKeys: [] }, 'long password');

    const to = setup({}, {});
    await importUserData({ ...to.storages, settingsKeys: [] }, text, 'long password');
    expect(await to.storages.data.getItem('direct.progress.p')).toBe('[2]');
    expect(await to.storages.secure.getItem('pin.a')).toBe('hash');
    expect(to.data.data.size + [...to.secure.data.keys()].filter((key) => key.startsWith('pin.')).length).toBe(0);
  });

  it('without a database, the storages as they are', () => {
    const data = createMemoryStorage();
    const secure = createMemoryStorage();
    const storages = { secure, data };
    expect(withUserDatabase(storages, undefined)).toBe(storages);
  });
});

function expectedOf(key: string) {
  return { 'direct.profiles.a': '[1]', 'direct.progress.p': '[2]', 'direct.watchlist.p': '[3]', 'settings.playback': '{}' }[key];
}
