import { afterEach, describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend, profile } from '../testing/fakeBackend';
import { createMemoryStorage } from '../stores/storage';
import { i18nStore, intlLocale, pluralForm, setUiLanguage, t, tn } from './i18n';
import { UI_LANGUAGE_KEY } from './uiLanguage';

afterEach(() => setUiLanguage('en'));

describe('t and tn (D-084)', () => {
  it('English is the source: the text itself, with its values filled in', () => {
    expect(t('Mark as watched')).toBe('Mark as watched');
    expect(t('Play {title} on {tv}', { title: 'Heat', tv: 'Living room' })).toBe('Play Heat on Living room');
    expect(t('Keep {unknown}')).toBe('Keep {unknown}');
    expect(tn('{count} episode', '{count} episodes', 1)).toBe('1 episode');
    expect(tn('{count} episode', '{count} episodes', 0)).toBe('0 episodes');
  });

  it('a text without a translation falls back to English', () => {
    setUiLanguage('de');
    expect(t('A text nobody translated {n}', { n: 2 })).toBe('A text nobody translated 2');
    expect(tn('{count} thing nobody translated', '{count} things nobody translated', 3)).toBe('3 things nobody translated');
  });

  it('plural forms per language', () => {
    expect([0, 1, 2].map((n) => pluralForm('en', n))).toEqual(['other', 'one', 'other']);
    expect([0, 1, 2].map((n) => pluralForm('pt-BR', n))).toEqual(['one', 'one', 'other']);
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111, 1.5].map((n) => pluralForm('sh-BA', n))).toEqual([
      'one',
      'few',
      'other',
      'other',
      'other',
      'one',
      'few',
      'other',
      'other',
      'other',
    ]);
  });

  it('dates use the language', () => {
    expect(intlLocale()).toBe('en-GB');
    setUiLanguage('sh-BA');
    expect(intlLocale()).toBe('bs-Latn-BA');
  });
});

describe('choosing the language (D-084)', () => {
  it("each profile keeps its language; the device's last choice is the start and the fallback", async () => {
    const backend = createFakeBackend();
    backend.on('POST', '/api/auth/login', {
      body: { token: 'tok', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile('p1'), profile('p2')] },
    });
    backend.on('GET', '/api/profiles/p1/progress', { body: [] });
    backend.on('GET', '/api/profiles/p2/progress', { body: [] });
    backend.on('GET', '/api/profiles/p1/watchlist', { body: [] });
    backend.on('GET', '/api/profiles/p2/watchlist', { body: [] });
    const storage = createMemoryStorage();
    storage.setItem(UI_LANGUAGE_KEY, 'pt-BR');
    const context = createAppContext({
      config: { apiBaseUrl: 'http://api.test', appName: 'Test', appSlug: 'test' },
      storage,
      fetch: backend.fetch,
    });
    await context.uiLanguage.load();
    expect(i18nStore.getState().language).toBe('pt-BR');

    await context.stores.session.getState().login({ serverUrl: 'http://provider.test', username: 'u', password: 'p' });
    context.stores.session.getState().selectProfile('p1');
    await context.uiLanguage.choose('de');
    expect(i18nStore.getState().language).toBe('de');
    expect(context.stores.profilePrefs.getState().prefs.p1?.appLanguage).toBe('de');
    expect(storage.getItem(UI_LANGUAGE_KEY)).toBe('de');

    // p2 never chose: the device's last choice stays. p1 again: its own.
    context.stores.session.getState().selectProfile('p2');
    await context.uiLanguage.choose('sh-BA');
    context.stores.session.getState().selectProfile('p1');
    expect(i18nStore.getState().language).toBe('de');
    context.stores.session.getState().selectProfile('p2');
    expect(i18nStore.getState().language).toBe('sh-BA');
  });
});
