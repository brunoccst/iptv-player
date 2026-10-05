import { groupTitles } from './matching';
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
/** How good a quality tag is; the best one is the title's (`bestQuality`). */
export const qualityRank = (quality: string) => tags.QUALITY_RANK[quality] ?? 0;
/**
 * The cover tag of a title whose versions are all cinema copies (CAM, TS, …): the least bad of them; otherwise null
 * (D-141). A version without a source tag counts as a good one.
 */
export function lowSourceOf(sources: (string | null)[]): string | null {
  if (sources.length === 0 || sources.some((source) => source === null || !tags.LOW_SOURCES.includes(source))) return null;
  return tags.LOW_SOURCES.find((source) => sources.includes(source)) ?? null;
}
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

/** Milliseconds per grouping step, without the breaks for the screen (D-116). */
export interface GroupingTimings {
  /** Reading the names (or taking them from the last library). */
  names: number;
  /** Grouping by key, year and TMDB id (D-133). */
  keys: number;
  /** Building the titles (or keeping unchanged ones). */
  titles: number;
  /** Hashing the new titles' ids, when done all at once (`hashIds`). */
  ids: number;
  sort: number;
  /** Waiting in breaks for the screen, and how many breaks. */
  waiting: number;
  breaks: number;
}

type GroupingStep = Exclude<keyof GroupingTimings, 'waiting' | 'breaks'>;

/**
 * Same result as `buildMasters`, but works in chunks and yields between them so the UI stays responsive, and
 * `onProgress(done, total)` reports how far it got (D-038). `done` runs from 0 to `total` across all steps: reading the
 * names (to 80 %), grouping them and building the titles (the rest). Only the library kept in memory (no database) is
 * built here; the database groups its titles itself (D-133).
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
    hashIds,
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
    /**
     * SHA-1 hex of each text, all at once (TV/phone: native code, D-118). Without it, each id is hashed in JavaScript
     * as the title is built. The ids are the same either way.
     */
    hashIds?(texts: string[]): Promise<string[]>;
  } = {},
): Promise<Master[]> {
  const usable = items.filter((item) => text(item.id) && text(item.name));
  const total = usable.length;
  const timings: GroupingTimings = {
    names: 0,
    keys: 0,
    titles: 0,
    ids: 0,
    sort: 0,
    waiting: 0,
    breaks: 0,
  };
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
  // Providers list the same movie in several categories under the same name: each name is read once (D-118).
  const readNow = new Map<string, ParsedTitle>();
  for (let start = 0; start < total; start += chunkSize) {
    for (const item of usable.slice(start, start + chunkSize)) {
      const name = String(item.name);
      const known = reuse.names.get(name);
      if (known) reusedNames++;
      let fromName = known ?? readNow.get(name);
      if (!fromName) {
        fromName = parseTitle(name);
        readNow.set(name, fromName);
      }
      names.push(fromName);
      parsed.push(withReleaseYear(fromName, item));
    }
    await pause((0.8 * parsed.length) / total, 'names');
  }
  work('names');
  const groups = groupTitles(parsed, usable.map(tmdbId));
  work('keys');
  const masters: Master[] = [];
  let reusedMasters = 0;
  // With `hashIds`, new titles get their ids afterwards, all in one go.
  const idTexts: string[] = [];
  const needIds: Master[] = [];
  const idOf = hashIds
    ? (idText: string) => {
        idTexts.push(idText);
        return '';
      }
    : hashedId;
  for (let start = 0; start < groups.length; start += chunkSize) {
    for (const group of groups.slice(start, start + chunkSize)) {
      const same = unchangedMaster(reuse, usable, group);
      if (same) reusedMasters++;
      const master = same ?? masterOf(accountId, mediaKind, usable, parsed, group, names, idOf);
      if (hashIds && !same) needIds.push(master);
      masters.push(master);
    }
    await pause(0.8 + (0.2 * Math.min(groups.length, start + chunkSize)) / groups.length, 'titles');
  }
  work('titles');
  if (hashIds && idTexts.length) {
    const hashed = await hashIds(idTexts);
    needIds.forEach((master, index) => (master.id = hashed[index]!.slice(0, 20)));
  }
  work('ids');
  onReuse?.({ names: reusedNames, masters: reusedMasters });
  onProgress?.(total, total);
  const sorted = sortMasters(masters);
  work('sort');
  onTimings?.(timings);
  return sorted;
}

function assemble(accountId: string, mediaKind: string, usable: NormalizerItem[], names: ParsedTitle[]): Master[] {
  const parsed = names.map((name, index) => withReleaseYear(name, usable[index]!));
  return sortMasters(groupTitles(parsed, usable.map(tmdbId)).map((group) => masterOf(accountId, mediaKind, usable, parsed, group, names)));
}

const masterOf = (
  accountId: string,
  mediaKind: string,
  usable: NormalizerItem[],
  parsed: ParsedTitle[],
  group: number[],
  names: ParsedTitle[],
  idOf: (idText: string) => string = hashedId,
) =>
  buildMaster(
    accountId,
    mediaKind,
    group.map((index) => usable[index]!),
    group.map((index) => parsed[index]!),
    group.map((index) => names[index]!),
    idOf,
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

export function qualityScore(title: Pick<ParsedTitle, 'quality' | 'source' | 'isHdr'>): number {
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
  hashedId(masterIdText(accountId, mediaKind, key, year));

/** What a master id is the SHA-1 of (its first 20 hex digits). */
export const masterIdText = (accountId: string, mediaKind: string, key: string, year: number | null) =>
  `${accountId}|${mediaKind}|${key}|${year ?? ''}`;

const hashedId = (idText: string) => sha1Hex(idText).slice(0, 20);

/** What the library database keeps of a provider item (D-133); null without an id or a name. */
export function savedItem(item: NormalizerItem) {
  if (!text(item.id) || !text(item.name)) return null;
  return {
    streamId: text(item.id),
    name: String(item.name),
    categoryId: optional(item.categoryId),
    posterUrl: optional(item.posterUrl),
    rating: typeof item.rating === 'number' ? item.rating : null,
    addedAt: typeof item.addedAt === 'number' && item.addedAt > 0 ? Math.trunc(item.addedAt) : null,
    released: releaseKey(optional(item.releaseDate), null),
    releaseYear: parseYear(text(item.releaseDate).slice(0, 4)),
    containerExtension: optional(item.containerExtension),
    tmdbId: tmdbId(item),
  };
}

/** The name's year, else the release date's. */
function withReleaseYear(parsed: ParsedTitle, item: NormalizerItem): ParsedTitle {
  const releaseYear = parsed.year === null ? parseYear(text(item.releaseDate).slice(0, 4)) : null;
  return releaseYear ? { ...parsed, year: releaseYear } : parsed;
}

function buildMaster(
  accountId: string,
  mediaKind: string,
  items: NormalizerItem[],
  parsed: ParsedTitle[],
  names: ParsedTitle[],
  idOf: (idText: string) => string,
): Master {
  const built = items.map((item, index) => buildVariant(item, parsed[index]!, names[index]!.year));
  const order = variantOrder(built);
  const variants = dedupeLabels(order.map((index) => built[index]!));
  const ordered = order.map((index) => parsed[index]!);

  // The most common spelling and year; ties go to the one with the best version, then the smallest stream id (the
  // database's query picks the same, D-133).
  const displayTitle = mostCommon(order.map((index) => ({ value: parsed[index]!.cleanTitle, variant: built[index]! })))!;
  const year = mostCommon(
    order.flatMap((index) => (parsed[index]!.year === null ? [] : [{ value: parsed[index]!.year!, variant: built[index]! }])),
  );
  const canonical = ordered.find((title) => title.cleanTitle === displayTitle)!;
  const ratings = variants.flatMap((variant) => (variant.rating === null ? [] : [variant.rating]));
  const qualities = variants.flatMap((variant) => (variant.quality ? [variant.quality] : []));
  const added = items.flatMap((item) => (typeof item.addedAt === 'number' && item.addedAt > 0 ? [Math.trunc(item.addedAt)] : []));
  const released = items.flatMap((item) => releaseKey(optional(item.releaseDate), null) ?? []);

  return {
    id: idOf(masterIdText(accountId, mediaKind, compactKey(canonical), year)),
    title: displayTitle,
    normalizedKey: canonical.key,
    year,
    posterUrl: variants.find((variant) => variant.posterUrl)?.posterUrl ?? null,
    rating: ratings.length ? Math.max(...ratings) : null,
    bestQuality: qualities.length ? qualities.reduce((best, quality) => (qualityRank(quality) > qualityRank(best) ? quality : best)) : null,
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

/** Best version first: quality score, then stream id. */
const variantOrder = (variants: Variant[]) =>
  variants
    .map((_, index) => index)
    .sort((a, b) => variants[b]!.qualityScore - variants[a]!.qualityScore || compare(variants[a]!.streamId, variants[b]!.streamId));

/** The value most versions have; ties go to the best version's value, then the smallest stream id among its versions. */
function mostCommon<T>(entries: { value: T; variant: Variant }[]): T | null {
  const counts = new Map<T, { count: number; score: number; streamId: string }>();
  for (const { value, variant } of entries) {
    const known = counts.get(value);
    if (!known) counts.set(value, { count: 1, score: variant.qualityScore, streamId: variant.streamId });
    else {
      known.count++;
      known.score = Math.max(known.score, variant.qualityScore);
      if (compare(variant.streamId, known.streamId) < 0) known.streamId = variant.streamId;
    }
  }
  let best: T | null = null;
  let bestOf: { count: number; score: number; streamId: string } | null = null;
  for (const [value, of] of counts) {
    if (
      !bestOf ||
      of.count > bestOf.count ||
      (of.count === bestOf.count && (of.score > bestOf.score || (of.score === bestOf.score && compare(of.streamId, bestOf.streamId) < 0)))
    ) {
      best = value;
      bestOf = of;
    }
  }
  return best;
}

/**
 * A title's versions from the database's rows (D-133), in the same order and with the same labels as a title built
 * here: best first, identical labels numbered.
 */
export function versionsOf(rows: { item: NormalizerItem; title: ParsedTitle }[]): Variant[] {
  const built = rows.map(({ item, title }) => buildVariant(item, title, title.year));
  return dedupeLabels(variantOrder(built).map((index) => built[index]!));
}
