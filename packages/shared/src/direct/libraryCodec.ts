import type { Master, Variant } from './normalizer/pipeline';

/**
 * Compact on-device format for the direct-mode library (D-038): arrays instead of objects, poster URL prefixes in a
 * table, and master poster/rating derived on load. A 125k-title catalog was ~85 MB as plain JSON; this is about a third.
 */
export const LIBRARY_FORMAT = 3;
/**
 * Version of the grouping and title rules the library was built with. A library from older rules still shows, but
 * counts as out of date, so it is rebuilt in the background (D-086: short tags in names, episode numbers; 3: Albanian and Kurdish prefixes;
 * 4: Greek, Ex-Yu, Punjabi and longer prefixes, D-107; 5: "PL = …" and "BL - …" prefixes, D-112;
 * 6: grouped by key, year and TMDB id only, no similar spellings, D-133).
 */
export const NORMALIZER_RULES = 6;

type PackedVariant = [
  streamId: string,
  rawTitle: string,
  label: string,
  quality: string | null,
  source: string | null,
  audioLanguages: string[],
  audioTag: string | null,
  isHdr: 0 | 1,
  qualityScore: number,
  categoryId: string | null,
  posterPrefix: number,
  posterRest: string | null,
  rating: number | null,
  containerExtension: string | null,
  /** Only when there are any (D-063) or when the next fields follow; files saved before it have 14 fields. */
  subtitleLanguages?: string[],
  /** What the parser read from the name (D-109): null = the title's own; files saved before have no such fields. */
  cleanTitle?: string | null,
  nameYear?: number | null,
];

export type PackedMaster = [
  id: string,
  title: string,
  normalizedKey: string,
  year: number | null,
  bestQuality: string | null,
  variants: PackedVariant[],
  addedAt: number | null,
  releaseKey: number | null,
];

export interface PackedLibrary {
  format: typeof LIBRARY_FORMAT;
  rules?: number;
  builtAt: string;
  prefixes: string[];
  masters: PackedMaster[];
}

export function packLibrary(builtAt: string, masters: Master[]): PackedLibrary {
  const { packMaster, prefixes } = packer();
  return { format: LIBRARY_FORMAT, rules: NORMALIZER_RULES, builtAt, prefixes, masters: masters.map(packMaster) };
}

/**
 * `JSON.stringify(packLibrary(…))`, built in chunks with `pause()` between them: 160,000 titles are ~30 MB of JSON,
 * which blocked a TV for seconds in one piece. Same data; `prefixes` comes last because it is complete only then.
 * Each chunk is on a line of its own (a line break is only whitespace to JSON, and JSON text has none inside strings),
 * so `readLibraryText` can read it a chunk at a time (D-120).
 */
export async function packLibraryText(builtAt: string, masters: Master[], pause: () => Promise<void>, chunkSize = 2000): Promise<string> {
  const { packMaster, prefixes } = packer();
  const chunks: string[] = [];
  for (let start = 0; start < masters.length; start += chunkSize) {
    chunks.push(
      masters
        .slice(start, start + chunkSize)
        .map((master) => JSON.stringify(packMaster(master)))
        .join(','),
    );
    await pause();
  }
  const head = `{"format":${LIBRARY_FORMAT},"rules":${NORMALIZER_RULES},"builtAt":${JSON.stringify(builtAt)},"masters":[`;
  return `${head}\n${chunks.join(',\n')}\n],"prefixes":${JSON.stringify(prefixes)}}`;
}

export function packer() {
  const prefixes: string[] = [];
  const prefixIndex = new Map<string, number>();
  const poster = (url: string | null): [number, string | null] => {
    if (!url) return [-1, null];
    const cut = url.lastIndexOf('/') + 1;
    const prefix = url.slice(0, cut);
    let index = prefixIndex.get(prefix);
    if (index === undefined) {
      index = prefixes.push(prefix) - 1;
      prefixIndex.set(prefix, index);
    }
    return [index, url.slice(cut)];
  };
  const packVariant = (v: Variant, title: string): PackedVariant => {
    const [posterPrefix, posterRest] = poster(v.posterUrl);
    const packed: PackedVariant = [
      v.streamId,
      v.rawTitle,
      v.label,
      v.quality,
      v.source,
      v.audioLanguages,
      v.audioTag,
      v.isHdr ? 1 : 0,
      v.qualityScore,
      v.categoryId,
      posterPrefix,
      posterRest,
      v.rating,
      v.containerExtension,
    ];
    if (v.cleanTitle !== undefined && v.nameYear !== undefined) {
      packed.push(v.subtitleLanguages, v.cleanTitle === title ? null : v.cleanTitle, v.nameYear);
    } else if (v.subtitleLanguages.length) packed.push(v.subtitleLanguages);
    return packed;
  };
  const packMaster = (m: Master): PackedMaster => [
    m.id,
    m.title,
    m.normalizedKey,
    m.year,
    m.bestQuality,
    m.variants.map((variant) => packVariant(variant, m.title)),
    m.addedAt,
    m.releaseKey,
  ];
  return { packMaster, prefixes };
}

/** `null` for anything that is not the current format (older files are rebuilt, not migrated). */
export function unpackLibrary(value: unknown): { builtAt: string; masters: Master[] } | null {
  const packed = checked(value);
  if (!packed) return null;
  const unpack = unpacker(packed.prefixes);
  return { builtAt: builtAtOf(packed), masters: packed.masters.map(unpack) };
}

/**
 * `unpackLibrary` in slices of about 100 ms with `pause()` between them, so the screen keeps running while a library
 * of 100k+ titles is unpacked (several seconds on a Chromecast, D-117).
 */
export async function unpackLibraryInSlices(
  value: unknown,
  pause: () => Promise<void>,
  sliceMs = 100,
): Promise<{ builtAt: string; masters: Master[] } | null> {
  const packed = checked(value);
  if (!packed) return null;
  const unpack = unpacker(packed.prefixes);
  const masters: Master[] = [];
  let sliceStarted = Date.now();
  for (let index = 0; index < packed.masters.length; index++) {
    masters.push(unpack(packed.masters[index]!));
    if (index % 500 === 499 && Date.now() - sliceStarted >= sliceMs) {
      await pause();
      sliceStarted = Date.now();
    }
  }
  return { builtAt: builtAtOf(packed), masters };
}

/**
 * `unpackLibrary(JSON.parse(text))` without one long `JSON.parse`: 35 MB took 4 s on a Chromecast, with the screen
 * frozen. A text from `packLibraryText` is read a line (2,000 titles) at a time, with `pause()` about every
 * `sliceMs`; an older text without lines is parsed in one piece. `pieces`: the lines read (0 for one piece).
 */
export async function readLibraryText(
  text: string,
  pause: () => Promise<void>,
  sliceMs = 100,
): Promise<{ builtAt: string; masters: Master[]; pieces: number } | null> {
  const first = text.indexOf('\n');
  if (first < 0 || !text.slice(0, first).endsWith('"masters":[')) {
    const value = JSON.parse(text) as unknown;
    await pause();
    const library = await unpackLibraryInSlices(value, pause, sliceMs);
    return library && { ...library, pieces: 0 };
  }
  const last = text.lastIndexOf('\n');
  // The first line ends with `"masters":[` and the last starts with `],"prefixes":`.
  const head = JSON.parse(`${text.slice(0, first)}]}`) as PackedLibrary;
  const tail = JSON.parse(`{"masters":[${text.slice(last + 1)}`) as Pick<PackedLibrary, 'prefixes'>;
  const packed = checked({ ...head, prefixes: tail.prefixes });
  if (!packed || !Array.isArray(packed.prefixes)) return null;
  const unpack = unpacker(packed.prefixes);
  const masters: Master[] = [];
  let pieces = 0;
  let sliceStarted = Date.now();
  for (let start = first + 1; start < last;) {
    const end = text.indexOf('\n', start);
    const line = text.slice(start, text.charCodeAt(end - 1) === 44 /* , */ ? end - 1 : end);
    start = end + 1;
    if (!line) continue;
    for (const master of JSON.parse(`[${line}]`) as PackedMaster[]) masters.push(unpack(master));
    pieces++;
    if (Date.now() - sliceStarted >= sliceMs) {
      await pause();
      sliceStarted = Date.now();
    }
  }
  return { builtAt: builtAtOf(packed), masters, pieces };
}

const checked = (value: unknown): PackedLibrary | null => {
  const packed = value as PackedLibrary | null;
  return packed && packed.format === LIBRARY_FORMAT && Array.isArray(packed.masters) ? packed : null;
};

// Built with older rules: shown until the background rebuild replaces it.
const builtAtOf = (packed: PackedLibrary) => (packed.rules === NORMALIZER_RULES ? packed.builtAt : new Date(0).toISOString());

export const unpacker =
  (prefixes: string[]) =>
  ([id, title, normalizedKey, year, bestQuality, packedVariants, addedAt, releaseKey]: PackedMaster): Master => {
    const variants = packedVariants.map((p): Variant => {
      const variant: Variant = {
        streamId: p[0],
        rawTitle: p[1],
        label: p[2],
        quality: p[3],
        source: p[4],
        audioLanguages: p[5],
        audioTag: p[6],
        isHdr: p[7] === 1,
        qualityScore: p[8],
        categoryId: p[9],
        posterUrl: p[11] === null ? null : `${prefixes[p[10]] ?? ''}${p[11]}`,
        rating: p[12],
        containerExtension: p[13],
        subtitleLanguages: p[14] ?? [],
      };
      if (p.length > 15) {
        variant.cleanTitle = p[15] ?? title;
        variant.nameYear = p[16] ?? null;
      }
      return variant;
    });
    const ratings = variants.flatMap((variant) => (variant.rating === null ? [] : [variant.rating]));
    return {
      id,
      title,
      normalizedKey,
      year,
      posterUrl: variants.find((variant) => variant.posterUrl)?.posterUrl ?? null,
      rating: ratings.length ? Math.max(...ratings) : null,
      bestQuality,
      addedAt,
      releaseKey,
      variants,
    };
  };
