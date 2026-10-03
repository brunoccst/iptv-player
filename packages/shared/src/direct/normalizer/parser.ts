import * as tags from './tags';

/** Regex title parser (D-017, D-038); the JSON cases in `cases/` describe what it must do. */
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
// Looked up once a day, not for every token: a new Date per call showed in TV profiles.
let maxYearValue = 0;
let maxYearUntil = 0;
const maxYear = () => {
  const time = Date.now();
  if (time >= maxYearUntil) {
    maxYearValue = new Date(time).getFullYear() + 1;
    maxYearUntil = time + 24 * 3600_000;
  }
  return maxYearValue;
};

/**
 * Multi-word tags folded into single tokens before tokenising ("WEB-DL" -> "webdl"). Each pattern only runs when the
 * lower-cased name contains one of its words: a substring search is far cheaper than a regex on a TV (D-093).
 */
const PHRASES: [RegExp, string, string[]][] = [
  [/\bweb[-_. ]?(dl|rip)\b/gi, 'web$1', ['web']],
  [/\bblu[-_. ]?ray\b/gi, 'bluray', ['blu']],
  [/\bhd[-_. ]?(cam|ts|tc|rip|tv)\b/gi, 'hd$1', ['hd']],
  [/\bcam[-_. ]?rip\b/gi, 'camrip', ['cam']],
  [/\bfull[-_. ]?hd\b/gi, 'fhd', ['full']],
  [/\bultra[-_. ]?hd\b/gi, 'uhd', ['ultra']],
  [/\bdual[-_. ]?(audio|aud)\b/gi, 'dual', ['dual']],
  [/\bmulti[-_. ]?(sub|subs)\b/gi, 'multisub', ['multi']],
  [/\bmulti[-_. ]?(audio|lang|language)\b/gi, 'multi', ['multi']],
  [/\bdolby[-_. ]?vision\b/gi, 'dovi', ['dolby']],
  [/\bhdr10(\+|plus)?/gi, 'hdr', ['hdr10']],
  [/\bpt[-_]br\b/gi, 'ptbr', ['pt-', 'pt_']],
  // Keeps the case, so "EX-YU - " is still an uppercase prefix group.
  [/\b(ex)[-_. ](yu)\b/gi, '$1$2', ['ex-', 'ex_', 'ex.', 'ex ']],
  [/\bh\.?26([45])\b/gi, 'x26$1', ['h26', 'h.26']],
  [/\bdd[p+]?[257]\.[01]\b/gi, 'ac3', ['dd']],
];

function foldPhrases(text: string): string {
  let lower = text.toLowerCase();
  for (const [pattern, replacement, keys] of PHRASES) {
    if (!keys.some((key) => lower.includes(key))) continue;
    const replaced = text.replace(pattern, replacement);
    if (replaced !== text) lower = (text = replaced).toLowerCase();
  }
  return text;
}

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

/** Every subtitle pattern contains "sub", "leg" or "vos"; names without them skip the long patterns. */
const MAYBE_SUBTITLES = /sub|leg|vos/i;

/** "EAR": English audio with Arabic subtitles burned into the picture (D-107). Capitals only: "ear" is a word. */
const ENGLISH_ARABIC = /\bEAR\b/g;

function extractSubtitles(raw: string): { text: string; languages: string[] } {
  const found: string[] = [];
  let text = raw;
  if (raw.includes('EAR')) {
    text = text.replace(ENGLISH_ARABIC, () => {
      if (!found.includes('ARA')) found.push('ARA');
      return 'ENG';
    });
  }
  if (!MAYBE_SUBTITLES.test(text)) return { text, languages: found };
  const keep = (code: string) => {
    if (!found.includes(code)) found.push(code);
    return ' sub ';
  };
  for (const pattern of [SUB_AFTER, SUB_BEFORE]) text = text.replace(pattern, (_match, word: string) => keep(subtitleCode(word)));
  for (const [pattern, code] of SUB_ONLY) text = text.replace(pattern, () => keep(code));
  return { text, languages: found };
}

// Numbered groups only: Babel turns named groups into a slow wrapper around every match on Hermes (D-093).
// "=" too ("PL = Title", D-112): the group before it must still be a known tag in capitals, so "E=MC2" stays a title.
const PREFIX = /^\s*[[(|]?\s*([A-Za-z0-9+]{2,8}(?:[-_ /][A-Za-z0-9+]{2,6}){0,2})\s*(?:[\])|:=]|\s[-–]\s)\s*/;
const BRACKET = /\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}/g;
const EDGE_PUNCTUATION = ' -–:|.,_/';
const TRAILING_ARTICLE = /^(.+),\s*(the|a|an)$/i;

/** Whitespace as `\s` matches it. */
const isSpace = (code: number) =>
  code === 32 ||
  (code >= 9 && code <= 13) ||
  code === 0xa0 ||
  code === 0x1680 ||
  (code >= 0x2000 && code <= 0x200a) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x202f ||
  code === 0x205f ||
  code === 0x3000 ||
  code === 0xfeff;
/** Token separators: whitespace and , / _ + | - – . */
const isTokenSeparator = (code: number) =>
  isSpace(code) ||
  code === 44 ||
  code === 47 ||
  code === 95 ||
  code === 43 ||
  code === 124 ||
  code === 45 ||
  code === 0x2013 ||
  code === 46;

/** 1 where an ASCII code is a separator, so the common case needs no function call per character. */
const asciiTable = (separator: (code: number) => boolean) => Uint8Array.from({ length: 128 }, (_, code) => (separator(code) ? 1 : 0));
const SPACE_TABLE = asciiTable(isSpace);
/** Every ASCII code except a-z and 0-9 (for lower-cased text). */
const NOT_ALNUM_TABLE = asciiTable((code) => !((code >= 97 && code <= 122) || (code >= 48 && code <= 57)));
const TOKEN_TABLE = asciiTable(isTokenSeparator);

/**
 * Non-empty runs between separators; same as `text.split(regex).filter(Boolean)`. A character loop: regex splits were a
 * large share of the time on TVs (Hermes has no JIT), and most tokens have nothing to split.
 */
function splitOn(text: string, table: Uint8Array, separator: (code: number) => boolean): string[] {
  const parts: string[] = [];
  let start = -1;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 128 ? table[code] === 1 : separator(code)) {
      if (start >= 0) parts.push(text.slice(start, index));
      start = -1;
    } else if (start < 0) start = index;
  }
  if (start >= 0) parts.push(start === 0 ? text : text.slice(start));
  return parts;
}

const splitTokens = (text: string) => splitOn(text, TOKEN_TABLE, isTokenSeparator);
const words = (text: string) => splitOn(text, SPACE_TABLE, isSpace);

/** Trims any of `chars` from both ends. */
function strip(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start]!)) start++;
  while (end > start && chars.includes(text[end - 1]!)) end--;
  return text.slice(start, end);
}

/** Has cased letters and all of them are uppercase. */
const isUpper = (text: string) => text === text.toUpperCase() && text !== text.toLowerCase();

/** Plain ASCII has no accents to remove; skips `normalize`, which is slow on Android TV (D-093). */
const NON_ASCII = /[\u0080-\uffff]/;
const removeMarks = (text: string) => (NON_ASCII.test(text) ? text.normalize('NFKD').replace(/\p{M}/gu, '') : text);

const FOLD_EDGES = EDGE_PUNCTUATION + '()[]';
/** The same few thousand tokens ("EN", "4K", "The", "-") come up in every name: fold each once (D-093). */
const folded = new Map<string, string>();
function fold(token: string): string {
  let result = folded.get(token);
  if (result === undefined) {
    if (folded.size >= 50_000) folded.clear();
    result = strip(removeMarks(token).toLowerCase(), FOLD_EDGES);
    folded.set(token, result);
  }
  return result;
}

const bestQuality = (current: string | null, candidate: string) =>
  current === null || (tags.QUALITY_RANK[candidate] ?? 0) > (tags.QUALITY_RANK[current] ?? 0) ? candidate : current;

/** What a folded word is in each tag table; looked up once per word (the tables are checked for every token). */
interface WordTags {
  quality: string | null;
  source: string | null;
  hdr: boolean;
  audioTag: string | null;
  long: string | null;
  short: string | null;
  prefix: string | null;
  ignoredPrefix: boolean;
  ignored: boolean;
}
const wordTags = new Map<string, WordTags>();
function lookup(word: string): WordTags {
  let known = wordTags.get(word);
  if (!known) {
    if (wordTags.size >= 50_000) wordTags.clear();
    const from = (table: tags.Table) => (tags.has(table, word) ? table[word]! : null);
    known = {
      quality: from(tags.QUALITY),
      source: from(tags.SOURCE),
      hdr: tags.HDR.has(word),
      audioTag: from(tags.AUDIO_TAG),
      long: from(tags.LANGUAGE_LONG),
      short: from(tags.LANGUAGE_SHORT),
      prefix: from(tags.LANGUAGE_PREFIX),
      ignoredPrefix: tags.IGNORED_PREFIX.has(word),
      ignored: tags.IGNORED.has(word),
    };
    wordTags.set(word, known);
  }
  return known;
}

class Tags {
  // Assigned in the constructor: class fields compile to a defineProperty call each (Babel), and probes make many Tags.
  quality: string | null;
  source: string | null;
  languages: string[];
  audioTag: string | null;
  hdr: boolean;

  constructor() {
    this.quality = null;
    this.source = null;
    this.languages = [];
    this.audioTag = null;
    this.hdr = false;
  }

  /** Records `token` if it is a known tag. False for unknown tokens (the same answer as `isTag`). `prefix`: a leading group ("GE - "). */
  absorb(token: string, allowShort: boolean, prefix = false): boolean {
    const word = fold(token);
    if (!word) return true;
    const known = lookup(word);
    if (known.quality) this.quality = bestQuality(this.quality, known.quality);
    else if (known.source) this.source ??= known.source;
    else if (known.hdr) this.hdr = true;
    else if (known.audioTag) this.audioTag ??= known.audioTag;
    else if (known.long) this.addLanguage(known.long);
    else if (known.short && (allowShort || isUpper(token))) this.addLanguage(known.short);
    else if (prefix && known.prefix) this.addLanguage(known.prefix);
    else if (prefix && known.ignoredPrefix) return true;
    else if (!known.ignored) return false;
    return true;
  }

  /** Absorbs "ENG-ESP" style tokens only if every part is a known tag; records nothing otherwise. */
  absorbCompound(token: string, allowShort: boolean, prefix = false): boolean {
    const parts = splitTokens(token);
    if (parts.length === 0 || !parts.every((part) => isTag(part, allowShort, prefix))) return false;
    for (const part of parts) this.absorb(part, allowShort, prefix);
    return true;
  }

  private addLanguage(code: string) {
    if (!this.languages.includes(code)) this.languages.push(code);
  }
}

/**
 * Whether `absorb` would take `token`, without recording anything. It depends only on the token, so no throw-away
 * `Tags` is needed to ask (thousands of them per library, D-118).
 */
function isTag(token: string, allowShort: boolean, prefix = false): boolean {
  const word = fold(token);
  if (!word) return true;
  const known = lookup(word);
  if (known.quality || known.source || known.hdr || known.audioTag || known.long) return true;
  if (known.short && (allowShort || isUpper(token))) return true;
  if (prefix && (known.prefix || known.ignoredPrefix)) return true;
  return known.ignored;
}

const YEAR = /^\(?\d{4}\)?$/;

export function parseYear(value: string | null | undefined): number | null {
  const text = value?.trim() ?? '';
  // "1999" to "(1999)": anything shorter or longer is not a year, without running the regex.
  if (text.length < 4 || text.length > 6 || !YEAR.test(text)) return null;
  const year = Number(strip(text, '() '));
  return year >= MIN_YEAR && year <= maxYear() ? year : null;
}

const APOSTROPHE = /['’`´]/;

/** Comparison key: accent-free, lowercase, punctuation-free, roman numerals as digits, no leading English article. */
export function normalizeKey(title: string): string {
  let text = removeMarks(title).toLowerCase();
  if (text.includes('&')) text = text.replaceAll('&', ' and ');
  if (APOSTROPHE.test(text)) text = text.replace(/['’`´]/g, '');
  // ASCII (after removeMarks, most names): split on anything but a-z0-9, the same as the Unicode classes but much
  // faster on Hermes.
  let tokens = (NON_ASCII.test(text) ? words(text.replace(/[^\p{L}\p{N}]+/gu, ' ')) : splitOn(text, NOT_ALNUM_TABLE, () => false)).map(
    (token) => (tags.has(tags.ROMAN_NUMERALS, token) ? tags.ROMAN_NUMERALS[token]! : token),
  );
  if (tokens.length > 1 && ['the', 'a', 'an'].includes(tokens[0]!)) tokens = tokens.slice(1);
  return tokens.join(' ');
}

/**
 * The key without spaces and without leading zeros in numbers ("Part 02" = "Part 2", D-133): what titles group on and
 * what their ids are made of.
 */
export const compactKey = (title: ParsedTitle) => title.key.replace(/(^|\D)0+(?=\d)/g, '$1').replaceAll(' ', '');

/** Every number in the key, also inside words ("EP197", "Part2"): episodes, scenes and sequels stay apart. */
export const numberTokens = (title: ParsedTitle) =>
  new Set((title.key.match(/\d+/g) ?? []).map((digits) => digits.replace(/^0+(?=\d)/, '')));

export function parseTitle(raw: string): ParsedTitle {
  const found = new Tags();
  const subtitles = extractSubtitles(raw);
  let text = subtitles.text;
  text = foldPhrases(text);

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
    const body = match[1]!;
    if (body !== body.toUpperCase()) break;
    if (!found.absorbCompound(body, true, true) && !isUnknownLanguagePrefix(match[0], body)) break;
    text = text.slice(match[0].length);
  }
  return text;
}

const UNKNOWN_LANGUAGE = /^[A-Z]{2,3}$/;

/**
 * A language not in the tables yet ("XY - Title", "|XY| Title", D-134): two or three capitals before " - " or between
 * pipes. Dropped with no language, so the title joins its other versions. Not before ":" or "=" ("CSI: Miami",
 * "E=MC2"), and not the acronyms in KEPT_PREFIX.
 */
function isUnknownLanguagePrefix(group: string, body: string): boolean {
  if (!UNKNOWN_LANGUAGE.test(body) || tags.KEPT_PREFIX.has(body.toLowerCase())) return false;
  const start = group.trimStart();
  const end = group.trimEnd();
  return end.endsWith('-') || end.endsWith('–') || (start.startsWith('|') && end.endsWith('|'));
}

function stripBrackets(text: string, found: Tags): { text: string; year: number | null } {
  if (!text.includes('[') && !text.includes('(') && !text.includes('{')) return { text, year: null };
  let year: number | null = null;
  const result = text.replace(BRACKET, (_match, square?: string, paren?: string, curly?: string) => {
    const content = square ?? paren ?? curly ?? '';
    const tokens = splitTokens(content);
    const years = tokens.map(parseYear);
    if (tokens.length > 0 && tokens.every((token, index) => years[index] !== null || isTag(token, true))) {
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

/** Tags like "TS", "CAM", "WEB", "NF" are also initials and name parts ("Wild Planet TS Rio"). */
const isShortWord = (word: string) => word.length <= 3 && /^\p{L}+$/u.test(word);

function onlyTags(tokens: string[]): boolean {
  return tokens.every((token) => splitTokens(token).every((part) => parseYear(part) !== null || isTag(part, false)));
}

/** The strong tags in a token ("1080p" in "1080p-WEB"); the same tokens recur in every name, so each is looked at once. */
const strongCache = new Map<string, string[]>();
function strongWords(token: string): string[] {
  let strong = strongCache.get(token);
  if (strong === undefined) {
    if (strongCache.size >= 50_000) strongCache.clear();
    strong = splitTokens(token)
      .map(fold)
      .filter((word) => tags.STRONG.has(word));
    strongCache.set(token, strong);
  }
  return strong;
}

/**
 * Cuts at the first year or strong tag after the first token. Everything after is the tag zone. A short strong tag
 * ("TS", "CAM", "NF") only cuts when nothing but tags follows it, so it can be part of a name.
 */
function splitTagZone(tokens: string[], found: Tags): { tokens: string[]; year: number | null } {
  for (let index = 1; index < tokens.length; index++) {
    const token = tokens[index]!;
    const year = parseYear(strip(token, EDGE_PUNCTUATION));
    if (year === null) {
      const strong = strongWords(token);
      if (strong.length === 0) continue;
      if (strong.every(isShortWord) && !onlyTags(tokens.slice(index + 1))) continue;
    }
    for (const tagToken of tokens.slice(index)) {
      for (const part of splitTokens(tagToken)) if (parseYear(part) === null) found.absorb(part, false);
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
  // words() + join: the same as collapsing whitespace runs with a regex, since strip() drops the edge spaces anyway.
  let text = strip(words(title).join(' '), EDGE_PUNCTUATION + ' ');
  if (text.includes('(')) text = text.replace(/\(\s*\)/g, '').trim();
  const match = text.includes(',') ? TRAILING_ARTICLE.exec(text) : null;
  if (match) {
    const article = match[2]!;
    text = `${article[0]!.toUpperCase()}${article.slice(1).toLowerCase()} ${match[1]}`;
  }
  return text;
}
