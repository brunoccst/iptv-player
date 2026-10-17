import { compactKey, parseTitle } from './normalizer/parser';
import { qualityRank, qualityScore } from './normalizer/pipeline';

/**
 * What the library database keeps of one provider name (D-017, D-133): the parsed title and the columns of the names
 * table after `name`, in order: title, nkey, ckey, nyear, quality, source, audio, atag, hdr, subs, score, qrank, langs.
 * The TV app also runs this outside the JavaScript thread, in the system WebView (issue #228, DECISIONS.md#d-188), so
 * it keeps to the parser and the quality rules (no storage, no logging).
 */
export type NameRow = [
  string,
  string,
  string,
  number | null,
  string | null,
  string | null,
  string,
  string | null,
  0 | 1,
  string,
  number,
  number,
  string,
];

const listOf = (values: Iterable<string>) => {
  const text = [...values].join(',');
  return text ? `,${text},` : '';
};

export function nameRow(name: string): NameRow {
  const title = parseTitle(name);
  return [
    title.cleanTitle,
    title.key,
    compactKey(title),
    title.year,
    title.quality,
    title.source,
    title.audioLanguages.join(','),
    title.audioTag,
    title.isHdr ? 1 : 0,
    title.subtitleLanguages.join(','),
    qualityScore(title),
    title.quality ? qualityRank(title.quality) : 0,
    listOf([...title.audioLanguages, ...title.subtitleLanguages]),
  ];
}
