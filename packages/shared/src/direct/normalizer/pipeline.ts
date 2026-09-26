import { groupTitles, groupTitlesAsync } from './matching';
import { compactKey, parseTitle, parseYear, type ParsedTitle } from './parser';
import { sha1Hex } from './sha1';
import * as tags from './tags';

/** Raw provider items → master titles with variants. Port of title_normalizer/pipeline.py (D-038). Pure: no I/O. */
export interface NormalizerItem {
  id?: unknown;
  name?: unknown;
  categoryId?: string | null;
  posterUrl?: string | null;
  rating?: number | null;
  containerExtension?: string | null;
  releaseDate?: string | null;
  /** Unix seconds the provider added (movies) or last changed (series) the item. */
  addedAt?: number | null;
}

export interface Variant {
  streamId: string;
  rawTitle: string;
  label: string;
  quality: string | null;
  source: string | null;
  audioLanguages: string[];
  audioTag: string | null;
  isHdr: boolean;
  qualityScore: number;
  categoryId: string | null;
  posterUrl: string | null;
  rating: number | null;
  containerExtension: string | null;
  /** From the name ("SUB ITA", "VOSTFR"); `MULTI` = several (D-063). */
  subtitleLanguages: string[];
}

export interface Master {
  id: string;
  title: string;
  normalizedKey: string;
  year: number | null;
  posterUrl: string | null;
  rating: number | null;
  bestQuality: string | null;
  /** Newest `addedAt` among the variants (Unix seconds). */
  addedAt: number | null;
  /** Release date as YYYYMMDD for sorting; a year-only date is YYYY0000. */
  releaseKey: number | null;
  variants: Variant[];
}

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());
const optional = (value: unknown) => text(value) || null;
const rank = (quality: string) => tags.QUALITY_RANK[quality] ?? 0;
/** Python compares str by code point; localeCompare would not. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildMasters(accountId: string, mediaKind: string, items: NormalizerItem[]): Master[] {
  const usable = items.filter((item) => text(item.id) && text(item.name));
  return assemble(accountId, mediaKind, usable, usable.map(parseItem));
}

/**
 * Same result as `buildMasters`, but works in chunks and yields between them so the UI stays responsive, and
 * `onProgress(done, total)` reports how far it got (direct mode on TV/phone, D-038). `done` runs from 0 to `total`
 * across all steps: reading the names (first half), matching them (to 80 %), building the titles (the rest).
 */
export async function buildMastersInChunks(
  accountId: string,
  mediaKind: string,
  items: NormalizerItem[],
  { chunkSize = 500, onProgress }: { chunkSize?: number; onProgress?(done: number, total: number): void } = {},
): Promise<Master[]> {
  const usable = items.filter((item) => text(item.id) && text(item.name));
  const total = usable.length;
  const pause = (fraction: number) => {
    onProgress?.(Math.min(total, Math.floor(fraction * total)), total);
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  const parsed: ParsedTitle[] = [];
  for (let start = 0; start < total; start += chunkSize) {
    for (const item of usable.slice(start, start + chunkSize)) parsed.push(parseItem(item));
    await pause((0.5 * parsed.length) / total);
  }
  const groups = await groupTitlesAsync(parsed, (done) => pause(0.5 + 0.3 * done));
  const masters: Master[] = [];
  for (let start = 0; start < groups.length; start += chunkSize) {
    for (const group of groups.slice(start, start + chunkSize)) masters.push(masterOf(accountId, mediaKind, usable, parsed, group));
    await pause(0.8 + (0.2 * Math.min(groups.length, start + chunkSize)) / groups.length);
  }
  onProgress?.(total, total);
  return sortMasters(masters);
}

function assemble(accountId: string, mediaKind: string, usable: NormalizerItem[], parsed: ParsedTitle[]): Master[] {
  return sortMasters(groupTitles(parsed).map((group) => masterOf(accountId, mediaKind, usable, parsed, group)));
}

const masterOf = (accountId: string, mediaKind: string, usable: NormalizerItem[], parsed: ParsedTitle[], group: number[]) =>
  buildMaster(
    accountId,
    mediaKind,
    group.map((index) => usable[index]!),
    group.map((index) => parsed[index]!),
  );

/** By title (case-insensitive), then year. Lower-cased once per title, not once per comparison. */
function sortMasters(masters: Master[]): Master[] {
  const keyed = masters.map((master) => ({ master, title: master.title.toLowerCase() }));
  keyed.sort((a, b) => compare(a.title, b.title) || (a.master.year ?? 0) - (b.master.year ?? 0));
  return keyed.map(({ master }) => master);
}

export function qualityScore(title: ParsedTitle): number {
  let score = title.quality ? (tags.QUALITY_RANK[title.quality] ?? tags.UNKNOWN_QUALITY_RANK) : tags.UNKNOWN_QUALITY_RANK;
  score += title.source ? (tags.SOURCE_ADJUSTMENT[title.source] ?? 0) : 0;
  score += title.isHdr ? 5 : 0;
  return Math.max(score, 0);
}

export function variantLabel(title: ParsedTitle, containerExtension: string | null): string {
  const parts = [
    title.quality,
    title.source && ['CAM', 'TS', 'TC', 'SCR', 'REMUX'].includes(title.source) ? title.source : null,
    title.isHdr ? 'HDR' : null,
    title.audioLanguages.join('/') || null,
    title.audioTag,
  ];
  return parts.filter(Boolean).join(' · ') || (containerExtension || 'Standard').toUpperCase();
}

/** YYYYMMDD from an ISO-like date ("2020-05-12"), else YYYY0000 from the year, for sorting. */
export function releaseKey(releaseDate: string | null, year: number | null): number | null {
  const match = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})/.exec(releaseDate ?? '');
  if (match && parseYear(match[1]!) && +match[2]! >= 1 && +match[2]! <= 12 && +match[3]! >= 1 && +match[3]! <= 31)
    return +match[1]! * 10000 + +match[2]! * 100 + +match[3]!;
  return year ? year * 10000 : null;
}

/** Stable across re-syncs while the group's key and year stay the same. Same hash as the Python normalizer. */
export const masterId = (accountId: string, mediaKind: string, key: string, year: number | null) =>
  sha1Hex(`${accountId}|${mediaKind}|${key}|${year ?? ''}`).slice(0, 20);

function parseItem(item: NormalizerItem): ParsedTitle {
  const parsed = parseTitle(String(item.name));
  const releaseYear = parsed.year === null ? parseYear(text(item.releaseDate).slice(0, 4)) : null;
  return releaseYear ? { ...parsed, year: releaseYear } : parsed;
}

function buildMaster(accountId: string, mediaKind: string, items: NormalizerItem[], parsed: ParsedTitle[]): Master {
  const built = items.map((item, index) => buildVariant(item, parsed[index]!));
  const order = built
    .map((_, index) => index)
    .sort((a, b) => built[b]!.qualityScore - built[a]!.qualityScore || compare(built[a]!.streamId, built[b]!.streamId));
  const variants = dedupeLabels(order.map((index) => built[index]!));
  const ordered = order.map((index) => parsed[index]!);

  // Most common spelling wins; ties go to the spelling seen first (best variant first).
  const titleCounts = countInOrder(ordered.map((title) => title.cleanTitle));
  const displayTitle = [...titleCounts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  const yearCounts = countInOrder(ordered.flatMap((title) => (title.year === null ? [] : [title.year])));
  const year = yearCounts.size ? [...yearCounts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0] : null;
  const canonical = ordered.find((title) => title.cleanTitle === displayTitle)!;
  const ratings = variants.flatMap((variant) => (variant.rating === null ? [] : [variant.rating]));
  const qualities = variants.flatMap((variant) => (variant.quality ? [variant.quality] : []));
  const added = items.flatMap((item) => (typeof item.addedAt === 'number' && item.addedAt > 0 ? [Math.trunc(item.addedAt)] : []));
  const released = items.flatMap((item) => releaseKey(optional(item.releaseDate), null) ?? []);

  return {
    id: masterId(accountId, mediaKind, compactKey(canonical), year),
    title: displayTitle,
    normalizedKey: canonical.key,
    year,
    posterUrl: variants.find((variant) => variant.posterUrl)?.posterUrl ?? null,
    rating: ratings.length ? Math.max(...ratings) : null,
    bestQuality: qualities.length ? qualities.reduce((best, quality) => (rank(quality) > rank(best) ? quality : best)) : null,
    addedAt: added.length ? Math.max(...added) : null,
    releaseKey: released.length ? Math.min(...released) : releaseKey(null, year),
    variants,
  };
}

function buildVariant(item: NormalizerItem, title: ParsedTitle): Variant {
  const container = optional(item.containerExtension);
  return {
    streamId: text(item.id),
    rawTitle: String(item.name),
    label: variantLabel(title, container),
    quality: title.quality,
    source: title.source,
    audioLanguages: title.audioLanguages,
    audioTag: title.audioTag,
    isHdr: title.isHdr,
    qualityScore: qualityScore(title),
    categoryId: optional(item.categoryId),
    posterUrl: optional(item.posterUrl),
    rating: typeof item.rating === 'number' ? item.rating : null,
    containerExtension: container,
    subtitleLanguages: title.subtitleLanguages,
  };
}

/** Identical labels get " (2)", " (3)" so the version selector stays unambiguous. */
function dedupeLabels(variants: Variant[]): Variant[] {
  const seen = new Map<string, number>();
  return variants.map((variant) => {
    const count = (seen.get(variant.label) ?? 0) + 1;
    seen.set(variant.label, count);
    return count === 1 ? variant : { ...variant, label: `${variant.label} (${count})` };
  });
}

function countInOrder<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
