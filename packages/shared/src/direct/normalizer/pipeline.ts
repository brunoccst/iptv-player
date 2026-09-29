import { groupTitles, groupTitlesAsync } from './matching';
import { compactKey, normalizeKey, parseTitle, parseYear, type ParsedTitle } from './parser';
import { sha1Hex } from './sha1';
import * as tags from './tags';

/** Raw provider items → master titles with variants (D-017, D-038). Pure: no I/O. */
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
  /** TMDB id when the provider's list sends one (D-065). */
  tmdbId?: unknown;
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
  /**
   * What the parser read from the name: its clean title and year (not the release date's). Kept so the next update
   * can skip parsing names that did not change (D-109). Missing in libraries saved before.
   */
  cleanTitle?: string;
  nameYear?: number | null;
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
/** Compares by code point; localeCompare would depend on the locale. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildMasters(accountId: string, mediaKind: string, items: NormalizerItem[]): Master[] {
  const usable = items.filter((item) => text(item.id) && text(item.name));
  return assemble(
    accountId,
    mediaKind,
    usable,
    usable.map((item) => parseTitle(String(item.name))),
  );
}

/** The TMDB id some providers send in their lists; "0" and empty mean none. */
export function tmdbId(item: NormalizerItem): string | null {
  const value = text(item.tmdbId);
  return /^\d+$/.test(value) && /[1-9]/.test(value) ? value : null;
}

/**
 * Joins name groups that share a TMDB id, e.g. "La Casa de Papel" and "Money Heist" (D-065). A shared id only joins
 * groups whose years agree (or are unknown): providers sometimes reuse an id for a remake or get it wrong.
 */
export function mergeByTmdb(groups: number[][], tmdbIds: (string | null)[], years: (number | null)[]): number[][] {
  const parent = groups.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]!]!;
      index = parent[index]!;
    }
    return index;
  };
  const groupYears = groups.map((group) => new Set(group.flatMap((i) => (years[i] === null ? [] : [years[i]!]))));
  const firstGroup = new Map<string, number>();
  groups.forEach((group, index) => {
    const ids = [...new Set(group.flatMap((i) => (tmdbIds[i] ? [tmdbIds[i]!] : [])))].sort(compare);
    for (const id of ids) {
      const other = firstGroup.get(id);
      if (other === undefined) {
        firstGroup.set(id, index);
        continue;
      }
      const root = find(index);
      const otherRoot = find(other);
      const a = groupYears[root]!;
      const b = groupYears[otherRoot]!;
      if (root !== otherRoot && (a.size === 0 || b.size === 0 || [...a].some((year) => b.has(year)))) {
        const low = Math.min(root, otherRoot);
        const high = Math.max(root, otherRoot);
        parent[high] = low;
        groupYears[low] = new Set([...a, ...b]);
      }
    }
  });
  const merged = new Map<number, number[]>();
  groups.forEach((group, index) => {
    const root = find(index);
    const list = merged.get(root);
    if (list) list.push(...group);
    else merged.set(root, [...group]);
  });
  return [...merged.values()].map((indexes) => indexes.sort((a, b) => a - b));
}

const byTmdb = (groups: number[][], usable: NormalizerItem[], parsed: ParsedTitle[]) =>
  mergeByTmdb(
    groups,
    usable.map(tmdbId),
    parsed.map((title) => title.year),
  );

/** Milliseconds per grouping step, without the breaks for the screen (D-116). */
export interface GroupingTimings {
  /** Reading the names (or taking them from the last library). */
  names: number;
  /** Matching: exact keys, and year-less titles joining a dated one. */
  exact: number;
  /** Matching: the keys for the similarity check. */
  keys: number;
  /** Matching: similar names within blocks. */
  similar: number;
  /** Joining groups that share a TMDB id. */
  tmdb: number;
  /** Building the titles (or keeping unchanged ones). */
  titles: number;
  sort: number;
  /** Waiting in breaks for the screen, and how many breaks. */
  waiting: number;
  breaks: number;
}

type GroupingStep = Exclude<keyof GroupingTimings, 'waiting' | 'breaks'>;

/**
 * Same result as `buildMasters`, but works in chunks and yields between them so the UI stays responsive, and
 * `onProgress(done, total)` reports how far it got (direct mode on TV/phone, D-038). `done` runs from 0 to `total`
 * across all steps: reading the names (first half), matching them (to 80 %), building the titles (the rest).
 *
 * It yields to the UI once `sliceMs` of work has passed, not after every chunk: on React Native each yield waits for
 * the next frame, and hundreds of them added seconds of idle time on a TV (D-093). 250 ms (it was 50): each break costs
 * at least a frame, so short slices spent a fifth of the time or more waiting; the progress still moves 4 times a
 * second (D-116).
 *
 * `onTimings` reports how long each step took, without the breaks (logged, D-116).
 */
export async function buildMastersInChunks(
  accountId: string,
  mediaKind: string,
  items: NormalizerItem[],
  {
    chunkSize = 500,
    sliceMs = 250,
    onProgress,
    yieldTo,
    previous,
    onReuse,
    onTimings,
  }: {
    chunkSize?: number;
    sliceMs?: number;
    onProgress?(done: number, total: number): void;
    /** Asked at every pause: a job to run first (e.g. a smaller list that just arrived), awaited before going on. */
    yieldTo?(): Promise<unknown> | null;
    /**
     * The same account's and kind's library from the last update, built with the current title rules (D-109): names
     * seen there are not parsed again, and titles whose versions did not change are kept as they were. The result is
     * the same as without it.
     */
    previous?: Master[];
    /** How many names and titles came from `previous`. */
    onReuse?(counts: { names: number; masters: number }): void;
    onTimings?(timings: GroupingTimings): void;
  } = {},
): Promise<Master[]> {
  const usable = items.filter((item) => text(item.id) && text(item.name));
  const total = usable.length;
  const timings: GroupingTimings = { names: 0, exact: 0, keys: 0, similar: 0, tmdb: 0, titles: 0, sort: 0, waiting: 0, breaks: 0 };
  let sliceStarted = Date.now();
  // Work since the last break or step, added to the step that did it.
  let workStarted = sliceStarted;
  const work = (step: GroupingStep) => {
    const now = Date.now();
    timings[step] += now - workStarted;
    workStarted = now;
  };
  const pause = async (fraction: number, step: GroupingStep) => {
    work(step);
    onProgress?.(Math.min(total, Math.floor(fraction * total)), total);
    const first = yieldTo?.();
    if (first) {
      // Another list's grouping: not this one's time.
      await first;
      sliceStarted = workStarted = Date.now();
      return;
    }
    if (Date.now() - sliceStarted < sliceMs) return;
    const waitStarted = Date.now();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    timings.waiting += Date.now() - waitStarted;
    timings.breaks++;
    sliceStarted = workStarted = Date.now();
  };

  const reuse = reuseFrom(previous);
  const parsed: ParsedTitle[] = [];
  const names: ParsedTitle[] = [];
  let reusedNames = 0;
  for (let start = 0; start < total; start += chunkSize) {
    for (const item of usable.slice(start, start + chunkSize)) {
      const name = String(item.name);
      const known = reuse.names.get(name);
      if (known) reusedNames++;
      const fromName = known ?? parseTitle(name);
      names.push(fromName);
      parsed.push(withReleaseYear(fromName, item));
    }
    await pause((0.5 * parsed.length) / total, 'names');
  }
  work('names');
  // Matching reports 0–0.1 for the exact keys (and year-less titles), to 0.2 for the similarity keys, then similar names.
  const matched = await groupTitlesAsync(parsed, (done) =>
    pause(0.5 + 0.3 * done, done <= 0.1 ? 'exact' : done <= 0.2 ? 'keys' : 'similar'),
  );
  work('similar');
  const groups = byTmdb(matched, usable, parsed);
  work('tmdb');
  const masters: Master[] = [];
  let reusedMasters = 0;
  for (let start = 0; start < groups.length; start += chunkSize) {
    for (const group of groups.slice(start, start + chunkSize)) {
      const same = unchangedMaster(reuse, usable, group);
      if (same) reusedMasters++;
      masters.push(same ?? masterOf(accountId, mediaKind, usable, parsed, group, names));
    }
    await pause(0.8 + (0.2 * Math.min(groups.length, start + chunkSize)) / groups.length, 'titles');
  }
  work('titles');
  onReuse?.({ names: reusedNames, masters: reusedMasters });
  onProgress?.(total, total);
  const sorted = sortMasters(masters);
  work('sort');
  onTimings?.(timings);
  return sorted;
}

function assemble(accountId: string, mediaKind: string, usable: NormalizerItem[], names: ParsedTitle[]): Master[] {
  const parsed = names.map((name, index) => withReleaseYear(name, usable[index]!));
  return sortMasters(
    byTmdb(groupTitles(parsed), usable, parsed).map((group) => masterOf(accountId, mediaKind, usable, parsed, group, names)),
  );
}

const masterOf = (
  accountId: string,
  mediaKind: string,
  usable: NormalizerItem[],
  parsed: ParsedTitle[],
  group: number[],
  names: ParsedTitle[],
) =>
  buildMaster(
    accountId,
    mediaKind,
    group.map((index) => usable[index]!),
    group.map((index) => parsed[index]!),
    group.map((index) => names[index]!),
  );

/** What an update can take from the last library (D-109). */
interface Reuse {
  /** Raw name → what the parser read from it. */
  names: Map<string, ParsedTitle>;
  /** Stream id → the title and version it was in. */
  streams: Map<string, { master: Master; variant: Variant }>;
}

function reuseFrom(previous: Master[] | undefined): Reuse {
  const names = new Map<string, ParsedTitle>();
  const streams = new Map<string, { master: Master; variant: Variant }>();
  for (const master of previous ?? []) {
    for (const variant of master.variants) {
      // Saved before D-109: nothing to reuse.
      if (variant.cleanTitle === undefined || variant.nameYear === undefined) continue;
      streams.set(variant.streamId, { master, variant });
      if (names.has(variant.rawTitle)) continue;
      names.set(variant.rawTitle, {
        raw: variant.rawTitle,
        cleanTitle: variant.cleanTitle,
        // The title's key is the key of its display title; any other spelling is keyed again (cheap next to parsing).
        key: variant.cleanTitle === master.title ? master.normalizedKey : normalizeKey(variant.cleanTitle),
        year: variant.nameYear,
        quality: variant.quality,
        source: variant.source,
        audioLanguages: variant.audioLanguages,
        audioTag: variant.audioTag,
        isHdr: variant.isHdr,
        subtitleLanguages: variant.subtitleLanguages,
      });
    }
  }
  return { names, streams };
}

/**
 * The last library's title for this group, when the group is exactly its versions and none of them changed: same
 * name, category, poster, rating and container. Only the dates are taken from the items again. Items with a release
 * date are always rebuilt (it can change the year, and it is not saved).
 */
function unchangedMaster(reuse: Reuse, usable: NormalizerItem[], group: number[]): Master | null {
  if (reuse.streams.size === 0) return null;
  let master: Master | null = null;
  let added: number | null = null;
  for (const index of group) {
    const item = usable[index]!;
    const known = reuse.streams.get(text(item.id));
    if (!known || (master && known.master !== master) || text(item.releaseDate)) return null;
    master = known.master;
    const { variant } = known;
    if (
      variant.rawTitle !== String(item.name) ||
      variant.categoryId !== optional(item.categoryId) ||
      variant.posterUrl !== optional(item.posterUrl) ||
      variant.rating !== (typeof item.rating === 'number' ? item.rating : null) ||
      variant.containerExtension !== optional(item.containerExtension)
    )
      return null;
    if (typeof item.addedAt === 'number' && item.addedAt > 0) added = Math.max(added ?? 0, Math.trunc(item.addedAt));
  }
  if (!master || master.variants.length !== group.length) return null;
  const releaseKeyNow = releaseKey(null, master.year);
  return master.addedAt === added && master.releaseKey === releaseKeyNow
    ? master
    : { ...master, addedAt: added, releaseKey: releaseKeyNow };
}

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

/** Stable across re-syncs while the group's key and year stay the same. Saved libraries and progress refer to it. */
export const masterId = (accountId: string, mediaKind: string, key: string, year: number | null) =>
  sha1Hex(`${accountId}|${mediaKind}|${key}|${year ?? ''}`).slice(0, 20);

/** The name's year, else the release date's. */
function withReleaseYear(parsed: ParsedTitle, item: NormalizerItem): ParsedTitle {
  const releaseYear = parsed.year === null ? parseYear(text(item.releaseDate).slice(0, 4)) : null;
  return releaseYear ? { ...parsed, year: releaseYear } : parsed;
}

function buildMaster(accountId: string, mediaKind: string, items: NormalizerItem[], parsed: ParsedTitle[], names: ParsedTitle[]): Master {
  const built = items.map((item, index) => buildVariant(item, parsed[index]!, names[index]!.year));
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

function buildVariant(item: NormalizerItem, title: ParsedTitle, nameYear: number | null): Variant {
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
    cleanTitle: title.cleanTitle,
    nameYear,
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
