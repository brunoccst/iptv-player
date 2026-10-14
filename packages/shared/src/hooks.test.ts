import { describe, expect, it, vi } from 'vitest';
import { createAppContext } from './appContext';
import { createAppHooks } from './hooks';
import { createMemoryStorage } from './stores/storage';
import { account, profile } from './testing/fakeBackend';

describe('app hooks', () => {
  it('another profile chosen with a page on screen reloads the lists after the cached ones are dropped', async () => {
    const { api, stores } = createAppContext({
      config: { appName: 'T', appSlug: 't' },
      storage: createMemoryStorage(),
      direct: { dataStorage: createMemoryStorage() },
    });
    stores.session.setState({ status: 'authenticated', account, profiles: [profile('p1'), profile('p2')], activeProfileId: 'p1' });
    await stores.profilePrefs.getState().load();
    await stores.profilePrefs.getState().update('p2', { languages: ['ENG'] });
    stores.library.setState({ pages: { home: { data: null, status: 'success', error: null, updatedAt: 1 } } });
    const pagesWhenReloaded: unknown[] = [];
    const reloadLists = vi.fn(() => pagesWhenReloaded.push(stores.library.getState().pages));
    createAppHooks({ api, stores, reloadLists });

    stores.session.getState().selectProfile('p2');
    expect(reloadLists).toHaveBeenCalledTimes(1);
    // The rows load again into the emptied cache, not the old profile's.
    expect(pagesWhenReloaded).toEqual([{}]);

    // The profile picker unmounts the pages, and the profile chosen there opens a new one: nothing to reload.
    stores.session.getState().selectProfile(null);
    stores.session.getState().selectProfile('p1');
    expect(reloadLists).toHaveBeenCalledTimes(1);
  });
});
