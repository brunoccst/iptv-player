import { describe, expect, it, vi } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend } from '../testing/fakeBackend';
import { bindDownloadsToAccount, DOWNLOADS_OWNER_KEY } from './downloadsOwner';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';

const config = { appName: 'Test', appSlug: 'test', apiBaseUrl: 'http://api.test' };

function setup(owner: string | null) {
  const backend = createFakeBackend();
  const storage = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [], activeProfileId: null }),
    ...(owner ? { [DOWNLOADS_OWNER_KEY]: owner } : {}),
  });
  const { stores } = createAppContext({ config, storage, fetch: backend.fetch });
  const removeAll = vi.fn(async () => undefined);
  const binding = bindDownloadsToAccount({ session: stores.session, storage, removeAll });
  const restore = () => stores.session.getState().restore().then(binding.settled);
  return { backend, storage, session: stores.session, removeAll, binding, restore };
}

describe('bindDownloadsToAccount', () => {
  it('keeps downloads of the same account and records the first owner', async () => {
    const same = setup(account.id);
    await same.restore();
    expect(same.removeAll).not.toHaveBeenCalled();

    const first = setup(null);
    await first.restore();
    expect(first.removeAll).not.toHaveBeenCalled();
    expect(await first.storage.getItem(DOWNLOADS_OWNER_KEY)).toBe(account.id);
  });

  it("removes another account's downloads", async () => {
    const { removeAll, storage, restore } = setup('someone-else');
    await restore();
    expect(removeAll).toHaveBeenCalledOnce();
    expect(await storage.getItem(DOWNLOADS_OWNER_KEY)).toBe(account.id);
  });

  it('signOut removes downloads, then signs out', async () => {
    const { backend, binding, removeAll, session, storage, restore } = setup(account.id);
    backend.on('POST', '/api/auth/logout', { status: 204 });
    await restore();
    await binding.signOut();
    expect(removeAll).toHaveBeenCalledOnce();
    expect(session.getState().status).toBe('anonymous');
    expect(await storage.getItem(DOWNLOADS_OWNER_KEY)).toBeNull();
  });
});
