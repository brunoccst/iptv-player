import type { MediaCategory } from '../api/types';
import * as tags from '../direct/normalizer/tags';

/**
 * The content language filter's category hint (D-086). Many titles carry no language in their names; their category
 * often does ("SRS | EN - ACTION", "SRS | DEUTSCH"). A title without a language of its own counts as its category's
 * language; in a category whose name has no language either ("VOD | DOCUMENTARIES FHD"), it is shown whatever the filter.
 */

/** Countries providers name categories after, when the language name is not there. */
const COUNTRIES: Record<string, string> = {
  usa: 'ENG',
  uk: 'ENG',
  england: 'ENG',
  spain: 'ESP',
  espana: 'ESP',
  mexico: 'LAT',
  latam: 'LAT',
  france: 'FRE',
  germany: 'GER',
  deutschland: 'GER',
  italy: 'ITA',
  italia: 'ITA',
  portugal: 'POR',
  brazil: 'POR',
  brasil: 'POR',
  russia: 'RUS',
  albania: 'ALB',
  kosovo: 'ALB',
  kurdistan: 'KUR',
  turkey: 'TUR',
  india: 'HIN',
  indian: 'HIN',
  japan: 'JPN',
  korea: 'KOR',
  china: 'CHI',
  netherland: 'DUT',
  netherlands: 'DUT',
  holland: 'DUT',
  poland: 'POL',
};

const fold = (word: string) => word.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** The languages a category's name says (`ENG`, `GER`…); empty when it says none. Two-letter codes only in capitals. */
export function categoryLanguages(name: string): string[] {
  const found = new Set<string>();
  for (const word of name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const key = fold(word);
    const code =
      tags.LANGUAGE_LONG[key] ??
      COUNTRIES[key] ??
      (word.length === 2 && word === word.toUpperCase() ? tags.LANGUAGE_SHORT[key] : undefined);
    if (code) found.add(code);
  }
  return [...found];
}

/**
 * The categories whose titles pass the filter when they have no language of their own: named in one of `languages`,
 * or named in no language at all.
 */
export function languageCategoryIds(categories: Pick<MediaCategory, 'id' | 'name'>[], languages: string[]): string[] {
  return categories
    .filter((category) => {
      const named = categoryLanguages(category.name);
      return named.length === 0 || named.some((code) => languages.includes(code));
    })
    .map((category) => category.id);
}
