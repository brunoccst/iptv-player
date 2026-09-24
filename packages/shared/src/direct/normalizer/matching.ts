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

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => map.set(key, [...(map.get(key) ?? []), value]);

/** Groups of indexes into `titles`. Each group becomes one master media object. */
export function groupTitles(titles: ParsedTitle[]): number[][] {
  // Pass 1: exact compact key + year ("Spider-Man" == "Spiderman").
  const exact = new Map<string, number[]>();
  titles.forEach((title, index) => push(exact, `${compactKey(title)}|${title.year ?? ''}`, index));
  const buckets = [...exact.values()];
  const union = new UnionFind(buckets.length);
  const representative = buckets.map((bucket) => titles[bucket[0]!]!);

  // Pass 2: a year-less bucket joins the single dated bucket with the same key. Ambiguous -> stays separate.
  const datedByKey = new Map<string, number[]>();
  representative.forEach((title, index) => title.year !== null && push(datedByKey, compactKey(title), index));
  representative.forEach((title, index) => {
    const candidates = datedByKey.get(compactKey(title)) ?? [];
    if (title.year === null && candidates.length === 1) union.union(index, candidates[0]!);
  });

  // Pass 3: fuzzy match within blocks sharing a key prefix (keeps comparisons near-linear).
  const blocks = new Map<string, number[]>();
  representative.forEach((title, index) => push(blocks, compactKey(title).slice(0, BLOCK_PREFIX_LENGTH), index));
  const featured = representative.map(features);
  for (const block of blocks.values()) {
    block.forEach((left, position) => {
      for (const right of block.slice(position + 1)) if (fuzzyMatch(featured[left]!, featured[right]!)) union.union(left, right);
    });
  }

  const merged = new Map<number, number[]>();
  buckets.forEach((bucket, index) => merged.set(union.find(index), [...(merged.get(union.find(index)) ?? []), ...bucket]));
  return [...merged.values()].map((indexes) => indexes.sort((a, b) => a - b));
}

/** Typo-tolerant match. Years must be equal; numbers must match (sequels); short keys only match exactly. */
export function isFuzzyMatch(left: ParsedTitle, right: ParsedTitle): boolean {
  return fuzzyMatch(features(left), features(right));
}

interface Features {
  year: number | null;
  key: string;
  length: number;
  numbers: Set<string>;
}

const features = (title: ParsedTitle): Features => {
  const key = compactKey(title);
  return { year: title.year, key, length: [...key].length, numbers: numberTokens(title) };
};

function fuzzyMatch(left: Features, right: Features): boolean {
  if (left.year !== right.year) return false;
  if (left.numbers.size !== right.numbers.size || [...left.numbers].some((token) => !right.numbers.has(token))) return false;
  if (Math.min(left.length, right.length) < MIN_FUZZY_LENGTH) return left.key === right.key;
  // ratio can be at most 200·min/(sum): skip the LCS when the lengths alone rule a match out. Same result, much faster.
  if ((200 * Math.min(left.length, right.length)) / (left.length + right.length) < FUZZY_THRESHOLD) return false;
  return ratio(left.key, right.key) >= FUZZY_THRESHOLD;
}

/** rapidfuzz `fuzz.ratio`: 100 · 2·LCS / (|a| + |b|), the normalized Indel similarity. */
export function ratio(a: string, b: string): number {
  const [x, y] = [[...a], [...b]];
  if (x.length + y.length === 0) return 100;
  let previous = new Array<number>(y.length + 1).fill(0);
  for (const charX of x) {
    const current = [0];
    y.forEach((charY, j) => current.push(charX === charY ? previous[j]! + 1 : Math.max(previous[j + 1]!, current[j]!)));
    previous = current;
  }
  return (200 * previous[y.length]!) / (x.length + y.length);
}
