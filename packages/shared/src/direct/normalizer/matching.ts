import { compactKey, numberTokens, type ParsedTitle } from './parser';

/** Groups parsed titles that refer to the same work. Port of title_normalizer/matching.py (D-017, D-038). */
const FUZZY_THRESHOLD = 90;
const MIN_FUZZY_LENGTH = 6;
const BLOCK_PREFIX_LENGTH = 4;

class UnionFind {
  private readonly parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }
  find(index: number): number {
    while (this.parent[index] !== index) {
      this.parent[index] = this.parent[this.parent[index]!]!;
      index = this.parent[index]!;
    }
    return index;
  }
  union(left: number, right: number) {
    const [a, b] = [this.find(left), this.find(right)];
    if (a !== b) this.parent[Math.max(a, b)] = Math.min(a, b);
  }
}

/** Appends in place (copying the list on every insert made large libraries quadratic). */
function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Groups of indexes into `titles`. Each group becomes one master media object. */
export function groupTitles(titles: ParsedTitle[]): number[][] {
  const steps = groupingSteps(titles);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/**
 * Same as `groupTitles`, but pauses now and then (`pause(done)`, done from 0 to 1) so a large library does not block
 * the UI: 160,000 titles take seconds even on a fast PC, and much longer on a TV (D-038).
 */
export async function groupTitlesAsync(titles: ParsedTitle[], pause: (done: number) => Promise<void>): Promise<number[][]> {
  const steps = groupingSteps(titles);
  let step = steps.next();
  while (!step.done) {
    await pause(step.value);
    step = steps.next();
  }
  return step.value;
}

/** Comparisons between pauses. */
const STEP_WORK = 5_000;

function* groupingSteps(titles: ParsedTitle[]): Generator<number, number[][]> {
  // Pass 1: exact compact key + year ("Spider-Man" == "Spiderman").
  const exact = new Map<string, number[]>();
  const keys: string[] = [];
  for (let index = 0; index < titles.length; index++) {
    const title = titles[index]!;
    keys.push(compactKey(title));
    push(exact, `${keys[index]}|${title.year ?? ''}`, index);
    if ((index + 1) % STEP_WORK === 0) yield (0.05 * index) / titles.length;
  }
  const buckets = [...exact.values()];
  const union = new UnionFind(buckets.length);
  const representative = buckets.map((bucket) => titles[bucket[0]!]!);
  const representativeKey = buckets.map((bucket) => keys[bucket[0]!]!);
  yield 0.05;

  // Pass 2: a year-less bucket joins the single dated bucket with the same key. Ambiguous -> stays separate.
  const datedByKey = new Map<string, number[]>();
  representative.forEach((title, index) => title.year !== null && push(datedByKey, representativeKey[index]!, index));
  yield 0.07;
  for (let index = 0; index < representative.length; index++) {
    const candidates = datedByKey.get(representativeKey[index]!) ?? [];
    if (representative[index]!.year === null && candidates.length === 1) union.union(index, candidates[0]!);
    if ((index + 1) % STEP_WORK === 0) yield 0.07 + (0.03 * index) / representative.length;
  }
  yield 0.1;

  // Pass 3: fuzzy match within blocks sharing a key prefix (keeps comparisons near-linear). A match needs the same year
  // and the same numbers, so they are part of the block key; inside a block, titles are sorted by length and each is
  // only compared with those short enough to pass the length check. Same pairs as comparing every pair, far fewer tries.
  const featured: Features[] = [];
  for (const title of representative) {
    featured.push(features(title));
    if (featured.length % STEP_WORK === 0) yield 0.1 + (0.1 * featured.length) / representative.length;
  }
  const blocks = new Map<string, number[]>();
  featured.forEach((feature, index) =>
    push(blocks, `${feature.key.slice(0, BLOCK_PREFIX_LENGTH)}|${feature.year ?? ''}|${[...feature.numbers].sort().join(',')}`, index),
  );
  yield 0.2;
  let work = 0;
  let blocksDone = 0;
  for (const block of blocks.values()) {
    blocksDone++;
    work += block.length;
    if (work >= STEP_WORK) {
      work = 0;
      yield 0.2 + (0.8 * blocksDone) / blocks.size;
    }
    if (block.length < 2) continue;
    block.sort((a, b) => featured[a]!.length - featured[b]!.length);
    for (let i = 0; i < block.length; i++) {
      const left = featured[block[i]!]!;
      for (let j = i + 1; j < block.length; j++) {
        const right = featured[block[j]!]!;
        if (!lengthsCanMatch(left.length, right.length)) break;
        work++;
        if (fuzzyMatch(left, right)) union.union(block[i]!, block[j]!);
      }
    }
  }

  const merged = new Map<number, number[]>();
  buckets.forEach((bucket, index) => {
    const root = union.find(index);
    const group = merged.get(root);
    if (group) group.push(...bucket);
    else merged.set(root, [...bucket]);
  });
  return [...merged.values()].map((indexes) => indexes.sort((a, b) => a - b));
}

/** Typo-tolerant match. Years must be equal; numbers must match (sequels); short keys only match exactly. */
export function isFuzzyMatch(left: ParsedTitle, right: ParsedTitle): boolean {
  return fuzzyMatch(features(left), features(right));
}

interface Features {
  year: number | null;
  key: string;
  /** Code points of the key. */
  chars: number[];
  length: number;
  numbers: Set<string>;
  /** Count per character, for a quick upper bound on the LCS. */
  counts: Map<number, number>;
}

const features = (title: ParsedTitle): Features => {
  const key = compactKey(title);
  const chars = Array.from(key, (char) => char.codePointAt(0)!);
  const counts = new Map<number, number>();
  for (const char of chars) counts.set(char, (counts.get(char) ?? 0) + 1);
  return { year: title.year, key, chars, length: chars.length, numbers: numberTokens(title), counts };
};

/** Characters both keys share (with repeats): the LCS can be at most this long. */
function sharedCharacters(left: Features, right: Features): number {
  let shared = 0;
  for (const [char, count] of left.counts) shared += Math.min(count, right.counts.get(char) ?? 0);
  return shared;
}

function fuzzyMatch(left: Features, right: Features): boolean {
  if (left.year !== right.year) return false;
  if (left.numbers.size !== right.numbers.size || [...left.numbers].some((token) => !right.numbers.has(token))) return false;
  if (Math.min(left.length, right.length) < MIN_FUZZY_LENGTH) return left.key === right.key;
  if (!lengthsCanMatch(left.length, right.length)) return false;
  // Cheap bound first: the LCS cannot be longer than the characters both keys share.
  if ((200 * sharedCharacters(left, right)) / (left.length + right.length) < FUZZY_THRESHOLD) return false;
  return lcsRatio(left.chars, right.chars) >= FUZZY_THRESHOLD;
}

/** ratio can be at most 200·min/(sum): the lengths alone can rule a match out, without the LCS. */
const lengthsCanMatch = (a: number, b: number) => (200 * Math.min(a, b)) / (a + b) >= FUZZY_THRESHOLD;

/** rapidfuzz `fuzz.ratio`: 100 · 2·LCS / (|a| + |b|), the normalized Indel similarity. */
export function ratio(a: string, b: string): number {
  return lcsRatio(
    Array.from(a, (char) => char.codePointAt(0)!),
    Array.from(b, (char) => char.codePointAt(0)!),
  );
}

function lcsRatio(x: number[], y: number[]): number {
  if (x.length + y.length === 0) return 100;
  let previous = new Uint16Array(y.length + 1);
  let current = new Uint16Array(y.length + 1);
  for (const charX of x) {
    for (let j = 0; j < y.length; j++) {
      current[j + 1] = charX === y[j] ? previous[j]! + 1 : Math.max(previous[j + 1]!, current[j]!);
    }
    [previous, current] = [current, previous];
  }
  return (200 * previous[y.length]!) / (x.length + y.length);
}
