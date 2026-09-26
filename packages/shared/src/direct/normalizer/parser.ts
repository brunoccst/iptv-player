import * as tags from './tags';

/** Regex title parser. Port of title_normalizer/parser.py (D-017, D-038); the shared JSON cases keep both in step. */
export interface ParsedTitle {
  raw: string;
  cleanTitle: string;
  key: string;
  year: number | null;
  quality: string | null;
  source: string | null;
  audioLanguages: string[];
  audioTag: string | null;
  isHdr: boolean;
  /** From "SUB ITA", "ENG SUB", "Legendado", "VOSTFR", "Multi-Sub" (D-063); `MULTI` = several, unnamed. */
  subtitleLanguages: string[];
}

const MIN_YEAR = 1900;
const maxYear = () => new Date().getFullYear() + 1;

/** Multi-word tags folded into single tokens before tokenising ("WEB-DL" -> "webdl"). */
const PHRASES: [RegExp, string][] = [
  [/\bweb[-_. ]?(dl|rip)\b/gi, 'web$1'],
  [/\bblu[-_. ]?ray\b/gi, 'bluray'],
  [/\bhd[-_. ]?(cam|ts|tc|rip|tv)\b/gi, 'hd$1'],
  [/\bcam[-_. ]?rip\b/gi, 'camrip'],
  [/\bfull[-_. ]?hd\b/gi, 'fhd'],
  [/\bultra[-_. ]?hd\b/gi, 'uhd'],
  [/\bdual[-_. ]?(audio|aud)\b/gi, 'dual'],
  [/\bmulti[-_. ]?(sub|subs)\b/gi, 'multisub'],
  [/\bmulti[-_. ]?(audio|lang|language)\b/gi, 'multi'],
  [/\bdolby[-_. ]?vision\b/gi, 'dovi'],
  [/\bhdr10(\+|plus)?/gi, 'hdr'],
  [/\bpt[-_]br\b/gi, 'ptbr'],
  [/\bh\.?26([45])\b/gi, 'x26$1'],
  [/\bdd[p+]?[257]\.[01]\b/gi, 'ac3'],
];

// Subtitles (D-063): a language next to a subtitle word is a subtitle language, not an audio one; the whole phrase then
// counts as a plain "sub" tag.
const SUB_WORD = '(?:subs?|subbed|subtitled|subtitles|leg|legendado|legendas)';
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LANG_WORD = [
  'pt[-_]?br',
  ...Object.keys({ ...tags.LANGUAGE_LONG, ...tags.LANGUAGE_SHORT })
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex),
].join('|');
const SUB_AFTER = new RegExp(`\\b${SUB_WORD}[\\s\\-_.:/|]*(${LANG_WORD})\\b`, 'gi');
const SUB_BEFORE = new RegExp(`\\b(${LANG_WORD})[\\s\\-_./|]*${SUB_WORD}\\b`, 'gi');
const SUB_ONLY: [RegExp, string][] = [
  [/\bvostfr\b/gi, 'FRE'],
  [/\bvose\b/gi, 'ESP'],
  [/\blegendado\b/gi, 'POR'],
  [/\bmulti[-_. ]?subs?\b/gi, 'MULTI'],
];

function subtitleCode(word: string): string {
  const folded = word.toLowerCase().replace(/[-_]/g, '');
  return folded === 'ptbr' ? 'POR' : (tags.LANGUAGE_LONG[folded] ?? tags.LANGUAGE_SHORT[folded]!);
}

function extractSubtitles(raw: string): { text: string; languages: string[] } {
  const found: string[] = [];
  const keep = (code: string) => {
    if (!found.includes(code)) found.push(code);
    return ' sub ';
  };
  let text = raw;
  for (const pattern of [SUB_AFTER, SUB_BEFORE]) text = text.replace(pattern, (_match, word: string) => keep(subtitleCode(word)));
  for (const [pattern, code] of SUB_ONLY) text = text.replace(pattern, () => keep(code));
  return { text, languages: found };
}

const PREFIX = /^\s*[[(|]?\s*(?<body>[A-Za-z0-9+]{2,6}(?:[-_ /][A-Za-z0-9+]{2,6}){0,2})\s*(?:[\])|:]|\s[-–]\s)\s*/;
const BRACKET = /\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}/g;
const TOKEN_SPLIT = /[\s,/_+|\-–.]+/;
const EDGE_PUNCTUATION = ' -–:|.,_/';
const TRAILING_ARTICLE = /^(?<rest>.+),\s*(?<article>the|a|an)$/i;

const splitTokens = (text: string) => text.split(TOKEN_SPLIT).filter(Boolean);
const words = (text: string) => text.split(/\s+/).filter(Boolean);

/** Python `str.strip(chars)`. */
function strip(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start]!)) start++;
  while (end > start && chars.includes(text[end - 1]!)) end--;
  return text.slice(start, end);
}

/** Python `str.isupper()`: has cased letters and all of them are uppercase. */
const isUpper = (text: string) => text === text.toUpperCase() && text !== text.toLowerCase();

const removeMarks = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '');

const fold = (token: string) => strip(removeMarks(token).toLowerCase(), EDGE_PUNCTUATION + '()[]');

const bestQuality = (current: string | null, candidate: string) =>
  current === null || (tags.QUALITY_RANK[candidate] ?? 0) > (tags.QUALITY_RANK[current] ?? 0) ? candidate : current;

class Tags {
  quality: string | null = null;
  source: string | null = null;
  languages: string[] = [];
  audioTag: string | null = null;
  hdr = false;

  /** Records `token` if it is a known tag. False for unknown tokens. `prefix`: a leading group ("GE - "). */
  absorb(token: string, allowShort: boolean, prefix = false): boolean {
    const word = fold(token);
    if (!word) return true;
    if (tags.has(tags.QUALITY, word)) this.quality = bestQuality(this.quality, tags.QUALITY[word]!);
    else if (tags.has(tags.SOURCE, word)) this.source ??= tags.SOURCE[word]!;
    else if (tags.HDR.has(word)) this.hdr = true;
    else if (tags.has(tags.AUDIO_TAG, word)) this.audioTag ??= tags.AUDIO_TAG[word]!;
    else if (tags.has(tags.LANGUAGE_LONG, word)) this.addLanguage(tags.LANGUAGE_LONG[word]!);
    else if (tags.has(tags.LANGUAGE_SHORT, word) && (allowShort || isUpper(token))) this.addLanguage(tags.LANGUAGE_SHORT[word]!);
    else if (prefix && tags.has(tags.LANGUAGE_PREFIX, word)) this.addLanguage(tags.LANGUAGE_PREFIX[word]!);
    else if (!tags.IGNORED.has(word)) return false;
    return true;
  }

  /** Absorbs "ENG-ESP" style tokens only if every part is a known tag; records nothing otherwise. */
  absorbCompound(token: string, allowShort: boolean, prefix = false): boolean {
    const parts = splitTokens(token);
    const probe = new Tags();
    if (parts.length === 0 || !parts.every((part) => probe.absorb(part, allowShort, prefix))) return false;
    for (const part of parts) this.absorb(part, allowShort, prefix);
    return true;
  }

  private addLanguage(code: string) {
    if (!this.languages.includes(code)) this.languages.push(code);
  }
}

export function parseYear(value: string | null | undefined): number | null {
  const text = value?.trim() ?? '';
  if (!/^\(?\d{4}\)?$/.test(text)) return null;
  const year = Number(strip(text, '() '));
  return year >= MIN_YEAR && year <= maxYear() ? year : null;
}

/** Comparison key: accent-free, lowercase, punctuation-free, roman numerals as digits, no leading English article. */
export function normalizeKey(title: string): string {
  let text = removeMarks(title).toLowerCase();
  text = text.replaceAll('&', ' and ').replace(/['’`´]/g, '');
  text = text.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  let tokens = words(text).map((token) => (tags.has(tags.ROMAN_NUMERALS, token) ? tags.ROMAN_NUMERALS[token]! : token));
  if (tokens.length > 1 && ['the', 'a', 'an'].includes(tokens[0]!)) tokens = tokens.slice(1);
  return tokens.join(' ');
}

export const compactKey = (title: ParsedTitle) => title.key.replaceAll(' ', '');

export const numberTokens = (title: ParsedTitle) => new Set(words(title.key).filter((token) => /^\d+$/.test(token)));

export function parseTitle(raw: string): ParsedTitle {
  const found = new Tags();
  const subtitles = extractSubtitles(raw);
  let text = subtitles.text;
  for (const [pattern, replacement] of PHRASES) text = text.replace(pattern, replacement);

  text = stripPrefixes(text, found);
  const bracket = stripBrackets(text, found);
  text = bracket.text;

  // Scene names use dots/underscores as spaces: "The.Matrix.1999.1080p".
  if (!text.trim().includes(' ') && ((text.match(/\./g)?.length ?? 0) >= 2 || text.includes('_'))) text = text.replace(/[._]/g, ' ');

  const zone = splitTagZone(words(text), found);
  const titleTokens = stripTrailingTags(zone.tokens, found);

  const clean = tidy(titleTokens.join(' ')) || tidy(raw);
  return {
    raw,
    cleanTitle: clean,
    key: normalizeKey(clean),
    year: bracket.year ?? zone.year,
    quality: found.quality,
    source: found.source,
    audioLanguages: found.languages,
    audioTag: found.audioTag,
    isHdr: found.hdr,
    subtitleLanguages: subtitles.languages,
  };
}

/** Removes leading tag groups like "EN - ", "|EN| ", "[4K-EN] ", "NF: ". Only uppercase groups qualify. */
function stripPrefixes(text: string, found: Tags): string {
  for (let match = PREFIX.exec(text); match; match = PREFIX.exec(text)) {
    const body = match.groups!.body!;
    if (body !== body.toUpperCase() || !found.absorbCompound(body, true, true)) break;
    text = text.slice(match[0].length);
  }
  return text;
}

function stripBrackets(text: string, found: Tags): { text: string; year: number | null } {
  let year: number | null = null;
  const result = text.replace(BRACKET, (_match, square?: string, paren?: string, curly?: string) => {
    const content = square ?? paren ?? curly ?? '';
    const tokens = splitTokens(content);
    const years = tokens.map(parseYear);
    const probe = new Tags();
    if (tokens.length > 0 && tokens.every((token, index) => years[index] !== null || probe.absorb(token, true))) {
      tokens.forEach((token, index) => {
        if (years[index] !== null) year ??= years[index]!;
        else found.absorb(token, true);
      });
      return ' ';
    }
    return paren !== undefined ? ` (${content}) ` : ' ';
  });
  return { text: result, year };
}

/** Cuts at the first year or strong tag after the first token. Everything after is the tag zone. */
function splitTagZone(tokens: string[], found: Tags): { tokens: string[]; year: number | null } {
  for (let index = 1; index < tokens.length; index++) {
    const token = tokens[index]!;
    const year = parseYear(strip(token, EDGE_PUNCTUATION));
    if (year === null && !token.split(TOKEN_SPLIT).some((part) => tags.STRONG.has(fold(part)))) continue;
    for (const tagToken of tokens.slice(index)) {
      for (const part of tagToken.split(TOKEN_SPLIT)) if (parseYear(part) === null) found.absorb(part, false);
    }
    return { tokens: tokens.slice(0, index), year };
  }
  return { tokens, year: null };
}

function stripTrailingTags(tokens: string[], found: Tags): string[] {
  while (tokens.length > 1) {
    const token = strip(tokens[tokens.length - 1]!, EDGE_PUNCTUATION);
    if (token && !found.absorbCompound(token, false)) break;
    tokens = tokens.slice(0, -1);
  }
  return tokens;
}

function tidy(title: string): string {
  let text = strip(title.replace(/\s+/g, ' '), EDGE_PUNCTUATION + ' ');
  text = text.replace(/\(\s*\)/g, '').trim();
  const match = TRAILING_ARTICLE.exec(text);
  if (match) {
    const article = match.groups!.article!;
    text = `${article[0]!.toUpperCase()}${article.slice(1).toLowerCase()} ${match.groups!.rest}`;
  }
  return text;
}
