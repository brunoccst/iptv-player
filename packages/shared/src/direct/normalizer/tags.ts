/** Tag vocabularies. Port of services/title-normalizer/title_normalizer/tags.py; keep both in step (D-038). */
type Table = Record<string, string>;

export const QUALITY: Table = {
  '4k': '4K',
  '2160p': '4K',
  uhd: '4K',
  '1080p': '1080p',
  '1080i': '1080p',
  fhd: '1080p',
  '720p': '720p',
  hd: '720p',
  '480p': 'SD',
  '576p': 'SD',
  sd: 'SD',
};

export const SOURCE: Table = {
  cam: 'CAM',
  camrip: 'CAM',
  hdcam: 'CAM',
  ts: 'TS',
  hdts: 'TS',
  telesync: 'TS',
  tsrip: 'TS',
  tc: 'TC',
  hdtc: 'TC',
  telecine: 'TC',
  scr: 'SCR',
  screener: 'SCR',
  dvdscr: 'SCR',
  web: 'WEB',
  webdl: 'WEB',
  webrip: 'WEB',
  hdrip: 'WEB',
  hdtv: 'HDTV',
  bluray: 'BLURAY',
  bdrip: 'BLURAY',
  brrip: 'BLURAY',
  remux: 'REMUX',
  dvdrip: 'DVD',
  dvd: 'DVD',
};

/** Accepted anywhere in the tag zone, any case. */
export const LANGUAGE_LONG: Table = {
  english: 'ENG',
  eng: 'ENG',
  spanish: 'ESP',
  espanol: 'ESP',
  castellano: 'ESP',
  spa: 'ESP',
  esp: 'ESP',
  latino: 'LAT',
  lat: 'LAT',
  french: 'FRE',
  francais: 'FRE',
  fre: 'FRE',
  fra: 'FRE',
  vf: 'FRE',
  vff: 'FRE',
  truefrench: 'FRE',
  german: 'GER',
  deutsch: 'GER',
  ger: 'GER',
  deu: 'GER',
  italian: 'ITA',
  italiano: 'ITA',
  ita: 'ITA',
  portuguese: 'POR',
  portugues: 'POR',
  por: 'POR',
  dublado: 'POR',
  ptbr: 'POR',
  russian: 'RUS',
  rus: 'RUS',
  turkish: 'TUR',
  turkce: 'TUR',
  tur: 'TUR',
  arabic: 'ARA',
  ara: 'ARA',
  hindi: 'HIN',
  hin: 'HIN',
  japanese: 'JPN',
  jpn: 'JPN',
  korean: 'KOR',
  kor: 'KOR',
  chinese: 'CHI',
  mandarin: 'CHI',
  chi: 'CHI',
  dutch: 'DUT',
  dut: 'DUT',
  nld: 'DUT',
  polish: 'POL',
  pol: 'POL',
};

/** Two-letter codes collide with real words ("It", "Us"): only accepted in prefixes, brackets, or uppercase. */
export const LANGUAGE_SHORT: Table = {
  en: 'ENG',
  es: 'ESP',
  mx: 'LAT',
  fr: 'FRE',
  de: 'GER',
  it: 'ITA',
  pt: 'POR',
  br: 'POR',
  ru: 'RUS',
  tr: 'TUR',
  ar: 'ARA',
  hi: 'HIN',
  jp: 'JPN',
  kr: 'KOR',
  nl: 'DUT',
  pl: 'POL',
};

/** Country-style codes providers put in front of titles ("GE - ", "IN - "). Only accepted as a leading prefix group:
 * as words they are too common ("All In"). */
export const LANGUAGE_PREFIX: Table = {
  ge: 'GER',
  in: 'HIN',
  uk: 'ENG',
  us: 'ENG',
};

export const AUDIO_TAG: Table = { dual: 'DUAL', multi: 'MULTI' };

export const HDR = new Set(['hdr', 'dovi']);

/** Recognised but carry no variant information (codecs, editions, subtitles, platforms). */
export const IGNORED = new Set([
  'x264',
  'x265',
  'hevc',
  'avc',
  '10bit',
  '8bit',
  'aac',
  'ac3',
  'eac3',
  'dts',
  'atmos',
  'truehd',
  'ddp',
  'sdr',
  '3d',
  'proper',
  'repack',
  'extended',
  'unrated',
  'uncut',
  'remastered',
  'imax',
  'sub',
  'subs',
  'subbed',
  'multisub',
  'vose',
  'vostfr',
  'legendado',
  'nf',
  'amzn',
  'amz',
  'dsnp',
  'dsny',
  'hmax',
  'hbo',
  'atvp',
  'hulu',
  'pcok',
  'netflix',
  'vod',
]);

export const STRONG = new Set([...Object.keys(QUALITY), ...Object.keys(SOURCE), ...HDR, ...Object.keys(AUDIO_TAG), ...IGNORED]);

export const ROMAN_NUMERALS: Table = {
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
  xi: '11',
  xii: '12',
  xiii: '13',
  xiv: '14',
  xv: '15',
};

export const QUALITY_RANK: Record<string, number> = { '4K': 400, '1080p': 300, '720p': 200, SD: 100 };
export const UNKNOWN_QUALITY_RANK = 150;
export const SOURCE_ADJUSTMENT: Record<string, number> = {
  CAM: -300,
  TS: -250,
  TC: -200,
  SCR: -150,
  HDTV: -20,
  DVD: -10,
  WEB: 10,
  BLURAY: 20,
  REMUX: 30,
};

export const has = (table: Table, key: string): key is string => Object.prototype.hasOwnProperty.call(table, key);
