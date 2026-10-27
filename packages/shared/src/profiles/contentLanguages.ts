import type { MediaCategory, VariantInfo } from '../api/types';
import { lowSourceOf, qualityRank } from '../direct/normalizer/pipeline';
import * as tags from '../direct/normalizer/tags';

/**
 * The content language filter's category hint (D-063). Many titles carry no language in their names; their category
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
  greece: 'GRE',
  hellas: 'GRE',
  yugoslavia: 'EXYU',
  serbia: 'EXYU',
  srbija: 'EXYU',
  croatia: 'EXYU',
  hrvatska: 'EXYU',
  bosnia: 'EXYU',
  montenegro: 'EXYU',
  punjab: 'PAN',
};

const fold = (word: string) => word.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** The languages a category's name says (`ENG`, `GER`…); empty when it says none. Two-letter codes only in capitals. */
export function categoryLanguages(name: string): string[] {
  const found = new Set<string>();
  // "EX-YU", "EX YU": one word, like "EXYU".
  for (const word of name
    .replace(/\b(ex)[-_. ]?(yu)\b/gi, '$1$2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)) {
    const key = fold(word);
    const code =
      tags.LANGUAGE_LONG[key] ??
      COUNTRIES[key] ??
      (word.length === 2 && word === word.toUpperCase() ? tags.LANGUAGE_SHORT[key] : undefined) ??
      // "EAR": English audio, Arabic subtitles in the picture (D-017).
      (word === 'EAR' ? 'ENG' : undefined);
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

/**
 * A version in one of `languages` (D-063): its audio or subtitles are, or it has neither and its category is one of
 * `categoryIds` (from `languageCategoryIds`).
 */
export const variantInLanguages = (
  variant: Pick<VariantInfo, 'audioLanguages' | 'subtitleLanguages' | 'categoryId'>,
  languages: readonly string[],
  categoryIds: ReadonlySet<string>,
): boolean =>
  languages.some((code) => variant.audioLanguages.includes(code) || variant.subtitleLanguages.includes(code)) ||
  (variant.audioLanguages.length === 0 &&
    variant.subtitleLanguages.length === 0 &&
    variant.categoryId !== null &&
    categoryIds.has(variant.categoryId));

/** The profile's languages and the categories that let versions without a language through (D-063). */
export interface LanguageScope {
  languages: readonly string[];
  categoryIds: ReadonlySet<string>;
}

type QualityOf = Pick<VariantInfo, 'audioLanguages' | 'subtitleLanguages' | 'categoryId' | 'quality' | 'source'>;

/** The cover's quality tags of these versions: the highest quality, and the cinema-copy tag when all are one (D-141). */
const qualityTags = (variants: readonly QualityOf[]) => {
  const qualities = variants.flatMap((variant) => (variant.quality ? [variant.quality] : []));
  return {
    bestQuality: qualities.length ? qualities.reduce((best, quality) => (qualityRank(quality) > qualityRank(best) ? quality : best)) : null,
    lowSource: lowSourceOf(variants.map((variant) => variant.source)),
  };
};

/**
 * The quality tags of the versions in the profile's languages (DECISIONS.md#d-235); null when it has none in them.
 * Without languages, of every version.
 */
export function qualityInLanguages(variants: readonly QualityOf[], scope: LanguageScope | null) {
  if (!scope || scope.languages.length === 0) return qualityTags(variants);
  const own = variants.filter((variant) => variantInLanguages(variant, scope.languages, scope.categoryIds));
  return own.length ? qualityTags(own) : null;
}

/** A cover's quality tags (DECISIONS.md#d-235): of the versions in the profile's languages, of every one when none is. */
export const coverQuality = (variants: readonly QualityOf[], scope: LanguageScope | null) =>
  qualityInLanguages(variants, scope) ?? qualityTags(variants);

/** The scope of a library list's languages (`ENG,GER`) and category hint; null for all languages. */
export const listLanguageScope = (languages: readonly string[], categoryIds: readonly string[] | null | undefined): LanguageScope | null =>
  languages.length ? { languages, categoryIds: new Set(categoryIds ?? []) } : null;
