import type { Master, Variant } from './normalizer/pipeline';

/**
 * Compact on-device format for the direct-mode library (D-038): arrays instead of objects, poster URL prefixes in a
 * table, and master poster/rating derived on load. A 125k-title catalog was ~85 MB as plain JSON; this is about a third.
 */
export const LIBRARY_FORMAT = 3;

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
];

type PackedMaster = [
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
  builtAt: string;
  prefixes: string[];
  masters: PackedMaster[];
}

export function packLibrary(builtAt: string, masters: Master[]): PackedLibrary {
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
  const packVariant = (v: Variant): PackedVariant => {
    const [posterPrefix, posterRest] = poster(v.posterUrl);
    return [
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
  };
  return {
    format: LIBRARY_FORMAT,
    builtAt,
    prefixes,
    masters: masters.map((m) => [
      m.id,
      m.title,
      m.normalizedKey,
      m.year,
      m.bestQuality,
      m.variants.map(packVariant),
      m.addedAt,
      m.releaseKey,
    ]),
  };
}

/** `null` for anything that is not the current format (older files are rebuilt, not migrated). */
export function unpackLibrary(value: unknown): { builtAt: string; masters: Master[] } | null {
  const packed = value as PackedLibrary | null;
  if (!packed || packed.format !== LIBRARY_FORMAT || !Array.isArray(packed.masters)) return null;
  const { prefixes } = packed;
  const masters = packed.masters.map(([id, title, normalizedKey, year, bestQuality, packedVariants, addedAt, releaseKey]): Master => {
    const variants = packedVariants.map((p): Variant => ({
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
    }));
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
  });
  return { builtAt: packed.builtAt, masters };
}
