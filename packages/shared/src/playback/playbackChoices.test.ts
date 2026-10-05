import { describe, expect, it } from 'vitest';
import { setUiLanguage } from '../i18n/i18n';
import { createTestAppContext } from '../testing/fakeBackend';
import type { MasterDetails, VariantInfo } from '../api/types';
import { selectVariant } from '../stores/libraryStore';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import { createMemoryStorage } from '../stores/storage';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import {
  chooseVersion,
  pickTrack,
  trackLabel,
  audioTrackLabels,
  bestVariant,
  playbackChoices,
  preferredVariant,
  rememberPlayback,
  startingVariant,
  usesPlaybackChoices,
  versionLanguages,
} from './playbackChoices';

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

  it("name a track by its language when the stream gives no name of its own, in the app's language (D-089)", () => {
    expect(trackLabel({ language: 'en', label: 'en' })).toBe('English');
    expect(trackLabel({ language: 'eng', label: '' })).toBe('English');
    expect(trackLabel({ language: 'pt-BR', label: 'PT-BR' })).toBe('Portuguese');
    expect(trackLabel({ language: 'sq', label: 'sq' })).toBe('Albanian');
    expect(trackLabel({ language: 'en', label: 'English 5.1' })).toBe('English 5.1');
    expect(trackLabel({ language: null, label: 'Commentary' })).toBe('Commentary');
    expect(trackLabel({ language: 'fi', label: 'fi' })).toBe('Finnish');
    expect(trackLabel({ language: 'und', label: 'Track 2' })).toBe('Track 2');
    setUiLanguage('de');
    expect(trackLabel({ language: 'en', label: 'en' })).toBe('Englisch');
    setUiLanguage('en');
  });

  it('call a lone unnamed audio track "Default": its language tag is often wrong (D-090)', () => {
    expect(audioTrackLabels([{ language: 'en', label: 'en' }])).toEqual(['Default']);
    expect(audioTrackLabels([{ language: 'en', label: 'Track 1' }])).toEqual(['Default']);
    expect(audioTrackLabels([{ language: null, label: '' }])).toEqual(['Default']);
    expect(audioTrackLabels([{ language: 'pt', label: 'Português 5.1' }])).toEqual(['Português 5.1']);
    expect(
      audioTrackLabels([
        { language: 'en', label: 'en' },
        { language: 'pt', label: 'pt' },
      ]),
    ).toEqual(['English', 'Portuguese']);
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

  it('mark as best only the highest quality; equally good versions go by language, else none is (D-136)', () => {
    const sameQuality = [variant('alb', ['ALB'], '1080p'), variant('en', ['ENG'], '1080p')];
    expect(bestVariant(sameQuality, ['ENG'])?.streamId).toBe('en');
    expect(bestVariant(sameQuality, ['GER', 'ALB', 'ENG'])?.streamId).toBe('alb');
    expect(bestVariant(sameQuality, ['GER'])).toBeNull();
    expect(bestVariant(sameQuality, [])).toBeNull();
    // A better quality is the best, whatever its language.
    const better = [variant('alb-4k', ['ALB'], '4K'), variant('en', ['ENG'], '1080p')];
    expect(bestVariant(better, ['ENG'])?.streamId).toBe('alb-4k');
    // Only the versions sharing the highest quality count.
    const three = [variant('alb-4k', ['ALB'], '4K'), variant('ger-4k', ['GER'], '4K'), variant('en', ['ENG'], '1080p')];
    expect(bestVariant(three, ['ENG', 'GER'])?.streamId).toBe('ger-4k');
    expect(bestVariant(three, ['ENG'])).toBeNull();
    expect(bestVariant([variant('one', ['ALB'], 'SD')], [])?.streamId).toBe('one');
  });

  it("start with the best version in the profile's languages, then the version choice, then the best (D-144)", () => {
    const versions = [variant('alb-4k', ['ALB'], '4K'), variant('en-720', ['ENG'], '720p'), variant('en-1080', ['ENG'], '1080p')];
    const start = (profileLanguages: string[], choice: { languages: string[]; quality: string | null } | null = null) =>
      startingVariant(versions, { profileLanguages, choice, languages: [...profileLanguages, 'ENG'] })?.streamId;
    // Issue #163: English chosen, an Albanian and an English version: English, in its best quality.
    expect(start(['ENG'])).toBe('en-1080');
    // The quality last picked, in the profile's language.
    expect(start(['ENG'], { languages: ['ENG'], quality: '720p' })).toBe('en-720');
    // A version last picked in another language does not beat the profile's language.
    expect(start(['ENG'], { languages: ['ALB'], quality: '4K' })).toBe('en-1080');
    expect(start(['ENG'], { languages: [], quality: '4K' })).toBe('en-1080');
    // The first of the profile's languages the title has.
    expect(start(['GER', 'ALB', 'ENG'])).toBe('alb-4k');
    // None in the profile's languages: the version choice, then the best.
    expect(start(['GER'], { languages: ['ENG'], quality: '720p' })).toBe('en-720');
    expect(start(['GER'])).toBe('alb-4k');
    expect(start([])).toBe('alb-4k');
    expect(startingVariant([], { profileLanguages: ['ENG'], choice: null, languages: [] })).toBeNull();
  });

  it("order the languages: the profile's, then the app's (D-136)", () => {
    expect(versionLanguages(['ALB'], 'en')).toEqual(['ALB', 'ENG']);
    expect(versionLanguages([], 'pt-BR')).toEqual(['POR']);
    expect(versionLanguages(['GER'], 'de')).toEqual(['GER']);
    expect(versionLanguages([], 'sh-BA')).toEqual(['EXYU']);
  });

  it('follow the open profile and the app language (D-136)', async () => {
    const { stores } = app();
    await stores.session.getState().restore();
    setUiLanguage('en');
    expect(stores.library.getState().versionLanguages).toEqual(['ENG']);
    setUiLanguage('de');
    expect(stores.library.getState().versionLanguages).toEqual(['GER']);
    await stores.profilePrefs.getState().update('p1', { languages: ['ALB'] });
    expect(stores.library.getState().versionLanguages).toEqual(['ALB', 'GER']);
    expect(stores.library.getState().profileLanguages).toEqual(['ALB']);
    setUiLanguage('en');
  });

  it("a version picked in one title is where the others start; a title's own pick wins", async () => {
    const { stores } = app();
    await stores.session.getState().restore();
    const heat = {
      id: 'heat',
      variants: [variant('h-de', ['GER'], '4K'), variant('h-en-hd', ['ENG'], '1080p'), variant('h-en-4k', ['ENG'], '4K')],
    } as MasterDetails;
    const up = { id: 'up', variants: [variant('u-de', ['GER'], '1080p'), variant('u-en', ['ENG'], '1080p')] } as MasterDetails;
    // Two 4K versions: the app's language (English) picks the best one (D-136).
    expect(selectVariant(stores.library.getState(), heat)?.streamId).toBe('h-en-4k');

    chooseVersion(stores, 'heat', heat.variants[2]!);
    expect(playbackChoices(stores).version).toEqual({ languages: ['ENG'], quality: '4K' });
    expect(selectVariant(stores.library.getState(), heat)?.streamId).toBe('h-en-4k');
    // No English 4K: English in another quality.
    expect(selectVariant(stores.library.getState(), up)?.streamId).toBe('u-en');
    stores.library.getState().selectVariant('up', 'u-de');
    expect(selectVariant(stores.library.getState(), up)?.streamId).toBe('u-de');

    // Another profile has its own choices.
    const coco = { id: 'coco', variants: [variant('c-de', ['GER'], '4K'), variant('c-en', ['ENG'], '1080p')] } as MasterDetails;
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
