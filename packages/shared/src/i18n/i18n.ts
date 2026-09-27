import { createStore } from 'zustand/vanilla';
import de from './catalogs/de.json';
import ptBR from './catalogs/pt-BR.json';
import shBA from './catalogs/sh-BA.json';

/**
 * The app's own words in the user's language (D-084). English is the source and the default: the English text is the
 * key (`t('Mark as watched')`), so code reads naturally and a missing translation shows the English text. Titles,
 * categories and other provider data are never translated.
 */

/** The languages of the app's own words. */
export const UI_LANGUAGES = [
  { id: 'en', name: 'English', intl: 'en-GB' },
  { id: 'pt-BR', name: 'Português (Brasil)', intl: 'pt-BR' },
  { id: 'de', name: 'Deutsch', intl: 'de-DE' },
  // Serbo-Croatian as written in Bosnia and Herzegovina: Latin script, ijekavian.
  { id: 'sh-BA', name: 'Srpskohrvatski (BiH)', intl: 'bs-Latn-BA' },
] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number]['id'];
export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en';

export const isUiLanguage = (value: unknown): value is UiLanguage => UI_LANGUAGES.some((language) => language.id === value);

/** A translation: text, or plural forms for `tn`. */
export type CatalogEntry = string | { one?: string; few?: string; other: string };
export type Catalog = Record<string, CatalogEntry>;

const CATALOGS: Record<Exclude<UiLanguage, 'en'>, Catalog> = { 'pt-BR': ptBR, de, 'sh-BA': shBA };

export type PluralForm = 'one' | 'few' | 'other';

/** CLDR plural categories of the four languages (kept here: not every JS engine on TVs has `Intl.PluralRules`). */
export function pluralForm(language: UiLanguage, count: number): PluralForm {
  const n = Math.abs(count);
  const whole = Number.isInteger(n);
  switch (language) {
    case 'pt-BR':
      // Brazilian Portuguese: 0 and 1 are singular ("0 episódio", "1 episódio").
      return whole && n <= 1 ? 'one' : 'other';
    case 'sh-BA': {
      if (!whole) return 'other';
      const ten = n % 10;
      const hundred = n % 100;
      if (ten === 1 && hundred !== 11) return 'one';
      if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return 'few';
      return 'other';
    }
    default:
      return n === 1 ? 'one' : 'other';
  }
}

export interface I18nState {
  language: UiLanguage;
}

/** The current language. Apps redraw everything when it changes (they key their root on it). */
export const i18nStore = createStore<I18nState>()(() => ({ language: DEFAULT_UI_LANGUAGE }));

export const currentLanguage = () => i18nStore.getState().language;

/** Locale for dates and numbers (`toLocaleDateString(intlLocale(), …)`). */
export const intlLocale = (language: UiLanguage = currentLanguage()) =>
  UI_LANGUAGES.find((entry) => entry.id === language)?.intl ?? 'en-GB';

export type TranslationParams = Record<string, string | number | null | undefined>;

const fill = (text: string, params?: TranslationParams) =>
  params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name] ?? '') : match)) : text;

function lookup(source: string): CatalogEntry | undefined {
  const language = currentLanguage();
  return language === 'en' ? undefined : CATALOGS[language][source];
}

/**
 * The app's text in the current language: `t('Play {title} on {tv}', { title, tv })`. The first argument must be a
 * string literal (the extraction check reads it, `npm run lint:i18n`), and `t` must run when drawing, not when a module
 * loads, so a language change applies.
 */
export function t(source: string, params?: TranslationParams): string {
  const entry = lookup(source);
  const text = typeof entry === 'string' && entry ? entry : typeof entry === 'object' ? (entry.one ?? entry.other) : source;
  return fill(text, params);
}

/**
 * Text that depends on a number: `tn('{count} episode', '{count} episodes', count)`. `{count}` is filled in; the
 * catalog entry (keyed by the singular) holds the forms the language needs: `one`, `few` (Serbo-Croatian), `other`.
 */
export function tn(one: string, other: string, count: number, params?: TranslationParams): string {
  const values = { count, ...params };
  const entry = lookup(one);
  const language = currentLanguage();
  if (entry && typeof entry === 'object') {
    const form = pluralForm(language, count);
    const text = entry[form] ?? entry.other;
    if (text) return fill(text, values);
  }
  return fill(pluralForm('en', count) === 'one' ? one : other, values);
}

/** Changes the language (no saving: see `createUiLanguage`). */
export function setUiLanguage(language: UiLanguage) {
  if (i18nStore.getState().language !== language) i18nStore.setState({ language });
}
