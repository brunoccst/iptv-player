import { t } from '../i18n/i18n';

/**
 * Names for the language codes video files tag their tracks with (ISO 639-1 "cs", 639-2 "cze"/"ces", and a few
 * others), in the app's language (D-090). The TV and phone apps run on Hermes, which has no `Intl.DisplayNames`, so
 * without this list they showed the bare code ("cs", "sv", "tgl").
 */
const trackLanguageNames = (): Record<string, string> => {
  const names: Record<string, string> = {};
  const add = (name: string, ...codes: string[]) => {
    for (const code of codes) names[code] = name;
  };
  add(t('Afrikaans'), 'af', 'afr');
  add(t('Amharic'), 'am', 'amh');
  add(t('Armenian'), 'hy', 'arm', 'hye');
  add(t('Azerbaijani'), 'az', 'aze');
  add(t('Basque'), 'eu', 'baq', 'eus');
  add(t('Belarusian'), 'be', 'bel');
  add(t('Bengali'), 'bn', 'ben');
  add(t('Bosnian'), 'bs', 'bos');
  add(t('Bulgarian'), 'bg', 'bul');
  add(t('Catalan'), 'ca', 'cat');
  add(t('Chinese'), 'zh', 'zho', 'cmn');
  add(t('Cantonese'), 'yue');
  add(t('Croatian'), 'hr', 'hrv', 'scr');
  add(t('Czech'), 'cs', 'cze', 'ces');
  add(t('Danish'), 'da', 'dan');
  add(t('Estonian'), 'et', 'est');
  add(t('Filipino'), 'fil');
  add(t('Finnish'), 'fi', 'fin');
  add(t('Galician'), 'gl', 'glg');
  add(t('Georgian'), 'ka', 'geo', 'kat');
  add(t('Greek'), 'el');
  add(t('Gujarati'), 'gu', 'guj');
  add(t('Hebrew'), 'he', 'iw', 'heb');
  add(t('Hungarian'), 'hu', 'hun');
  add(t('Icelandic'), 'is', 'ice', 'isl');
  add(t('Indonesian'), 'id', 'ind');
  add(t('Irish'), 'ga', 'gle');
  add(t('Japanese'), 'ja');
  add(t('Kannada'), 'kn', 'kan');
  add(t('Kazakh'), 'kk', 'kaz');
  add(t('Khmer'), 'km', 'khm');
  add(t('Korean'), 'ko');
  add(t('Lao'), 'lo', 'lao');
  add(t('Latvian'), 'lv', 'lav');
  add(t('Lithuanian'), 'lt', 'lit');
  add(t('Macedonian'), 'mk', 'mac', 'mkd');
  add(t('Malay'), 'ms', 'may', 'msa', 'zsm');
  add(t('Malayalam'), 'ml', 'mal');
  add(t('Marathi'), 'mr', 'mar');
  add(t('Mongolian'), 'mn', 'mon');
  add(t('Montenegrin'), 'cnr');
  add(t('Nepali'), 'ne', 'nep');
  add(t('Norwegian'), 'no', 'nor', 'nb', 'nob', 'nn', 'nno');
  add(t('Persian'), 'fa', 'per', 'fas');
  add(t('Romanian'), 'ro', 'rum', 'ron', 'mo', 'mol');
  add(t('Serbian'), 'sr', 'srp', 'scc');
  add(t('Serbo-Croatian'), 'sh', 'hbs');
  add(t('Sinhala'), 'si', 'sin');
  add(t('Slovak'), 'sk', 'slo', 'slk');
  add(t('Slovenian'), 'sl', 'slv');
  add(t('Somali'), 'so', 'som');
  add(t('Swahili'), 'sw', 'swa');
  add(t('Swedish'), 'sv', 'swe');
  add(t('Tagalog'), 'tl', 'tgl');
  add(t('Tamil'), 'ta', 'tam');
  add(t('Telugu'), 'te', 'tel');
  add(t('Thai'), 'th', 'tha');
  add(t('Ukrainian'), 'uk', 'ukr');
  add(t('Urdu'), 'ur', 'urd');
  add(t('Uzbek'), 'uz', 'uzb');
  add(t('Vietnamese'), 'vi', 'vie');
  add(t('Welsh'), 'cy', 'wel', 'cym');
  // "und" (undetermined): the file has the track but does not say its language.
  add(t('Unknown language'), 'und');
  return names;
};

/**
 * The name of a track language code from the list above, or null. A code with a second language part names the
 * more precise one: "hbs-hrv" is Croatian, "ms-ind" Indonesian; a region or script part ("pt-BR", "zh-Hans") does not.
 */
export function listedTrackLanguage(code: string): string | null {
  const parts = code.toLowerCase().split(/[-_]/);
  const names = trackLanguageNames();
  const precise = parts[1];
  if (precise && /^[a-z]{3}$/.test(precise) && names[precise]) return names[precise]!;
  return names[parts[0]!] ?? null;
}
