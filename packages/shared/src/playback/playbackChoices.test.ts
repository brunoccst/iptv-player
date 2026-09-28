import { describe, expect, it } from 'vitest';
import { createTestAppContext } from '../testing/fakeBackend';
import type { MasterDetails, VariantInfo } from '../api/types';
import { selectVariant } from '../stores/libraryStore';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import { createMemoryStorage } from '../stores/storage';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { chooseVersion, pickTrack, playbackChoices, preferredVariant, rememberPlayback, usesPlaybackChoices } from './playbackChoices';

const variant = (streamId: string, audioLanguages: string[], quality: string | null) =>
  ({ streamId, audioLanguages, quality, label: streamId }) as unknown as VariantInfo;

function app() {
  const [first, second] = [profile('p1'), profile('p2')];
  const storage = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [first, second], activeProfileId: 'p1' }),
  });
  const context = createTestAppContext({
    config: { appName: 'T', appSlug: 't' },
    storage,
    backend: createFakeBackend(),
  });
  return { ...context, storage };
}

describe('playback choices for every movie and series (D-087)', () => {
  it('apply to movies and episodes, not to live channels', () => {
    expect(usesPlaybackChoices({ kind: 'movie' })).toBe(true);
    expect(usesPlaybackChoices({ kind: 'episode' })).toBe(true);
    expect(usesPlaybackChoices({ kind: 'live' })).toBe(false);
  });

  it('match a track again by language and name, not by position', () => {
    const tracks = [
      { language: 'en', label: 'English' },
      { language: 'pt', label: 'Português' },
      { language: 'pt', label: 'Português (forced)' },
    ];
    expect(pickTrack(tracks, { language: 'pt', label: 'Português (forced)' })).toBe(2);
    expect(pickTrack(tracks, { language: 'PT', label: 'Portuguese' })).toBe(1);
    expect(pickTrack(tracks, { language: null, label: 'english' })).toBe(0);
    expect(pickTrack(tracks, { language: 'de', label: 'Deutsch' })).toBeNull();
    expect(pickTrack(tracks, { off: true })).toBe(-1);
    expect(pickTrack(tracks, null)).toBeNull();
  });

  it('pick a version in the chosen language, the same quality first', () => {
    const variants = [variant('de-4k', ['GER'], '4K'), variant('en-1080', ['ENG'], '1080p'), variant('en-4k', ['ENG', 'GER'], '4K')];
    expect(preferredVariant(variants, { languages: ['ENG'], quality: '4K' })?.streamId).toBe('en-4k');
    expect(preferredVariant(variants, { languages: ['ENG'], quality: '720p' })?.streamId).toBe('en-1080');
    expect(preferredVariant(variants, { languages: ['POR'], quality: '4K' })).toBeNull();
    expect(preferredVariant(variants, { languages: [], quality: '1080p' })?.streamId).toBe('en-1080');
    expect(preferredVariant(variants, { languages: [], quality: 'SD' })).toBeNull();
    expect(preferredVariant(variants, null)).toBeNull();
  });

  it("a version picked in one title is where the others start; a title's own pick wins", async () => {
    const { stores } = app();
    await stores.session.getState().restore();
    const heat = {
      id: 'heat',
      variants: [variant('h-de', ['GER'], '4K'), variant('h-en-hd', ['ENG'], '1080p'), variant('h-en-4k', ['ENG'], '4K')],
    } as MasterDetails;
    const up = { id: 'up', variants: [variant('u-de', ['GER'], '1080p'), variant('u-en', ['ENG'], '1080p')] } as MasterDetails;
    expect(selectVariant(stores.library.getState(), heat)?.streamId).toBe('h-de');

    chooseVersion(stores, 'heat', heat.variants[2]!);
    expect(playbackChoices(stores).version).toEqual({ languages: ['ENG'], quality: '4K' });
    expect(selectVariant(stores.library.getState(), heat)?.streamId).toBe('h-en-4k');
    // No English 4K: English in another quality.
    expect(selectVariant(stores.library.getState(), up)?.streamId).toBe('u-en');
    stores.library.getState().selectVariant('up', 'u-de');
    expect(selectVariant(stores.library.getState(), up)?.streamId).toBe('u-de');

    // Another profile has its own choices.
    const coco = { id: 'coco', variants: [variant('c-de', ['GER'], '4K'), variant('c-en', ['ENG'], '4K')] } as MasterDetails;
    expect(selectVariant(stores.library.getState(), coco)?.streamId).toBe('c-en');
    stores.session.getState().selectProfile('p2');
    expect(selectVariant(stores.library.getState(), coco)?.streamId).toBe('c-de');
    stores.session.getState().selectProfile('p1');
    expect(selectVariant(stores.library.getState(), coco)?.streamId).toBe('c-en');
  });

  it('subtitles and audio are kept for the open profile and survive a restart', async () => {
    const { stores, storage } = app();
    await stores.session.getState().restore();
    rememberPlayback(stores, { subtitles: { language: 'en', label: 'English' } });
    rememberPlayback(stores, { audio: { language: 'en', label: 'English 5.1' } });
    expect(playbackChoices(stores)).toEqual({
      subtitles: { language: 'en', label: 'English' },
      audio: { language: 'en', label: 'English 5.1' },
    });
    rememberPlayback(stores, { subtitles: { off: true } });
    expect(playbackChoices(stores).subtitles).toEqual({ off: true });

    const again = createTestAppContext({
      config: { appName: 'T', appSlug: 't' },
      storage,
      backend: createFakeBackend(),
    });
    await again.stores.session.getState().restore();
    await again.stores.profilePrefs.getState().load();
    expect(playbackChoices(again.stores).audio).toEqual({ language: 'en', label: 'English 5.1' });
  });
});
