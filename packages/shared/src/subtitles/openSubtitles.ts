import { createStore } from 'zustand/vanilla';
import type { KeyValueStorage } from '../stores/storage';
import { t } from '../i18n/i18n';
import type { PlayTarget } from '../playback/targets';
import { appLog, errorMessage } from '../utils/logger';

/**
 * Automatic subtitles from OpenSubtitles.com (D-111, issue #103). When a movie or episode starts and none of its own
 * subtitles is in a preferred language, the best subtitle in the first preferred language that has one is downloaded
 * and turned on. Needs the user's own API key (free on opensubtitles.com); an OpenSubtitles account raises the daily
 * downloads from 5 per IP to the account's quota. A downloaded subtitle is kept, so watching again costs nothing.
 */

const API = 'https://api.opensubtitles.com/api/v1';
/** Where the settings are kept: the device's secure storage (the key and password are secrets). */
export const SUBTITLE_SETTINGS_KEY = 'settings.opensubtitles';
const CACHE_INDEX_KEY = 'opensubtitles.cache';
const CACHE_ENTRY = (key: string) => `opensubtitles.cache.${key}`;
/** Subtitles kept on the device (a few dozen KB each); the oldest go first. */
const CACHE_SIZE = 40;

export interface SubtitleSettings {
  enabled: boolean;
  apiKey: string;
  /** Optional OpenSubtitles account: more downloads per day than without. */
  username: string;
  password: string;
  /** OpenSubtitles language codes in order of preference, e.g. `['pt-br', 'en']`. */
  languages: string[];
}

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = { enabled: false, apiKey: '', username: '', password: '', languages: ['en'] };

/** The languages offered in the settings: OpenSubtitles codes and their names in the app's language. */
export const subtitleLanguageNames = (): Record<string, string> => ({
  en: t('English'),
  es: t('Spanish'),
  'pt-br': t('Portuguese (Brazil)'),
  'pt-pt': t('Portuguese'),
  fr: t('French'),
  de: t('German'),
  it: t('Italian'),
  nl: t('Dutch'),
  pl: t('Polish'),
  ru: t('Russian'),
  tr: t('Turkish'),
  ar: t('Arabic'),
  el: t('Greek'),
  sr: t('Serbian'),
  hr: t('Croatian'),
  bs: t('Bosnian'),
  sq: t('Albanian'),
  hi: t('Hindi'),
  pa: t('Punjabi'),
  ja: t('Japanese'),
  ko: t('Korean'),
  'zh-cn': t('Chinese'),
});

/** OpenSubtitles code → the codes a stream's own track may carry (ISO 639-1 and -2), to see if one is already there. */
const TRACK_CODES: Record<string, string[]> = {
  en: ['en', 'eng'],
  es: ['es', 'spa'],
  'pt-br': ['pt', 'por', 'pt-br'],
  'pt-pt': ['pt', 'por', 'pt-pt'],
  fr: ['fr', 'fre', 'fra'],
  de: ['de', 'ger', 'deu'],
  it: ['it', 'ita'],
  nl: ['nl', 'dut', 'nld'],
  pl: ['pl', 'pol'],
  ru: ['ru', 'rus'],
  tr: ['tr', 'tur'],
  ar: ['ar', 'ara'],
  el: ['el', 'gre', 'ell'],
  sr: ['sr', 'srp'],
  hr: ['hr', 'hrv'],
  bs: ['bs', 'bos'],
  sq: ['sq', 'alb', 'sqi'],
  hi: ['hi', 'hin'],
  pa: ['pa', 'pan'],
  ja: ['ja', 'jpn'],
  ko: ['ko', 'kor'],
  'zh-cn': ['zh', 'chi', 'zho', 'zh-cn'],
};

/** Whether a track language (as the player reports it) is one of the preferred subtitle languages. */
export function isPreferredTrack(language: string | null | undefined, preferred: string[]): boolean {
  const code = (language ?? '').toLowerCase();
  if (!code) return false;
  return preferred.some((pick) => (TRACK_CODES[pick] ?? [pick]).some((known) => code === known || code.startsWith(`${known}-`)));
}

/** A downloaded subtitle, ready for the player. */
export interface FoundSubtitle {
  /** OpenSubtitles language code. */
  language: string;
  /** For the track list, e.g. "English · OpenSubtitles". */
  label: string;
  /** The subtitle file (SubRip), UTF-8. */
  srt: string;
}

/** Why no subtitle was added; `message` is for the user (`null` = nothing worth saying). */
export interface SubtitleMiss {
  message: string | null;
}

interface SearchResult {
  id: string;
  attributes: {
    language?: string;
    download_count?: number;
    machine_translated?: boolean;
    ai_translated?: boolean;
    from_trusted?: boolean;
    files?: { file_id: number; file_name?: string }[];
  };
}

/** Search parameters, sorted and in lower case as the API asks (otherwise it answers with a redirect). */
export function searchQuery(
  target: Pick<PlayTarget, 'kind' | 'title' | 'seasonNumber' | 'episodeNumber'>,
  languages: string[],
  year?: number | null,
): string {
  const params: Record<string, string> = { languages: [...languages].sort().join(','), query: target.title.trim().toLowerCase() };
  if (target.kind === 'episode') {
    params.type = 'episode';
    if (target.seasonNumber != null) params.season_number = String(target.seasonNumber);
    if (target.episodeNumber != null) params.episode_number = String(target.episodeNumber);
  } else {
    params.type = 'movie';
    if (year) params.year = String(year);
  }
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key]!).replace(/%20/g, '+').replace(/%2C/g, ',')}`)
    .join('&');
}

/** The best file per language: people's own subtitles first (not machine or AI translated), then the most downloaded. */
export function bestFile(results: SearchResult[], languages: string[]): { fileId: number; language: string } | null {
  const score = (result: SearchResult) =>
    (result.attributes.machine_translated || result.attributes.ai_translated ? 0 : 1_000_000_000) +
    (result.attributes.from_trusted ? 100_000_000 : 0) +
    (result.attributes.download_count ?? 0);
  for (const language of languages) {
    const candidates = results
      .filter((result) => result.attributes.language?.toLowerCase() === language && result.attributes.files?.length)
      .sort((a, b) => score(b) - score(a));
    const file = candidates[0]?.attributes.files?.[0];
    if (file) return { fileId: file.file_id, language };
  }
  return null;
}

/** SubRip → WebVTT for the browser's `<track>` (desktop app). */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}

export interface SubtitleServiceOptions {
  /** Secure storage: the settings hold the API key and the account password. */
  secureStorage: KeyValueStorage;
  /** Where downloaded subtitles are kept. */
  dataStorage: KeyValueStorage;
  fetch?: typeof fetch;
  /** Sent as the User-Agent the API requires, e.g. "IPTV Player v1.0.39". */
  userAgent: string;
}

export interface SubtitleSettingsState {
  settings: SubtitleSettings;
  loaded: boolean;
  load(): Promise<void>;
  save(settings: SubtitleSettings): Promise<void>;
}

export function createSubtitleService({ secureStorage, dataStorage, fetch: fetchImpl, userAgent }: SubtitleServiceOptions) {
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const settings = createStore<SubtitleSettingsState>()((set) => ({
    settings: DEFAULT_SUBTITLE_SETTINGS,
    loaded: false,
    async load() {
      try {
        const saved = JSON.parse((await secureStorage.getItem(SUBTITLE_SETTINGS_KEY)) ?? 'null') as Partial<SubtitleSettings> | null;
        session = null;
        set({ settings: { ...DEFAULT_SUBTITLE_SETTINGS, ...(saved ?? {}) }, loaded: true });
      } catch {
        set({ settings: DEFAULT_SUBTITLE_SETTINGS, loaded: true });
      }
    },
    async save(next) {
      set({ settings: next });
      session = null;
      await secureStorage.setItem(SUBTITLE_SETTINGS_KEY, JSON.stringify(next));
    },
  }));

  /** The account's token and the server to use with it (VIP accounts get another one); kept until the settings change. */
  let session: Promise<{ token: string | null; base: string }> | null = null;
  const headers = (apiKey: string, token?: string | null): Record<string, string> => ({
    'Api-Key': apiKey,
    'User-Agent': userAgent,
    'X-User-Agent': userAgent,
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const login = (current: SubtitleSettings) => {
    if (!current.username || !current.password) return Promise.resolve({ token: null, base: API });
    session ??= doFetch(`${API}/login`, {
      method: 'POST',
      headers: { ...headers(current.apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: current.username, password: current.password }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`login ${response.status}`);
        const body = (await response.json()) as { token?: string; base_url?: string };
        return { token: body.token ?? null, base: body.base_url ? `https://${body.base_url.replace(/^https?:\/\//, '')}/api/v1` : API };
      })
      .catch((error: unknown) => {
        session = null;
        appLog.warn('subtitles', `OpenSubtitles login failed: ${errorMessage(error)}`);
        // Without the account: the anonymous quota still works.
        return { token: null, base: API };
      });
    return session;
  };

  const cacheKey = (target: Pick<PlayTarget, 'kind' | 'streamId'>) => `${target.kind}.${target.streamId}`;
  const cached = async (key: string, languages: string[]): Promise<FoundSubtitle | null> => {
    try {
      const entry = JSON.parse((await dataStorage.getItem(CACHE_ENTRY(key))) ?? 'null') as FoundSubtitle | null;
      return entry && languages.includes(entry.language) ? entry : null;
    } catch {
      return null;
    }
  };
  const remember = async (key: string, found: FoundSubtitle) => {
    try {
      const index = (JSON.parse((await dataStorage.getItem(CACHE_INDEX_KEY)) ?? '[]') as string[]).filter((k) => k !== key);
      index.push(key);
      for (const old of index.splice(0, Math.max(0, index.length - CACHE_SIZE))) await dataStorage.removeItem(CACHE_ENTRY(old));
      await dataStorage.setItem(CACHE_ENTRY(key), JSON.stringify(found));
      await dataStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      appLog.warn('subtitles', `could not keep the subtitle: ${errorMessage(error)}`);
    }
  };

  /**
   * A subtitle for `target` in one of the preferred languages, or why there is none. `trackLanguages`: the languages
   * of the stream's own subtitle tracks; when one is preferred, nothing is downloaded.
   */
  async function find(
    target: PlayTarget,
    { trackLanguages = [], year = null }: { trackLanguages?: (string | null)[]; year?: number | null } = {},
  ): Promise<FoundSubtitle | SubtitleMiss> {
    const current = settings.getState().settings;
    const names = subtitleLanguageNames();
    const languages = current.languages.filter((code) => names[code]);
    if (!current.enabled || !current.apiKey.trim() || languages.length === 0) return { message: null };
    if (target.kind !== 'movie' && target.kind !== 'episode') return { message: null };
    if (trackLanguages.some((language) => isPreferredTrack(language, languages))) return { message: null };
    const key = cacheKey(target);
    const saved = await cached(key, languages);
    if (saved) return saved;
    try {
      const { token, base } = await login(current);
      const search = await doFetch(`${base}/subtitles?${searchQuery(target, languages, year)}`, {
        headers: headers(current.apiKey, token),
      });
      if (search.status === 401 || search.status === 403) return { message: t('OpenSubtitles did not accept the API key.') };
      if (!search.ok) throw new Error(`search ${search.status}`);
      const results = ((await search.json()) as { data?: SearchResult[] }).data ?? [];
      const best = bestFile(results, languages);
      if (!best) {
        appLog.info('subtitles', `no subtitle for "${target.title}" in ${languages.join(', ')}`);
        return { message: t('No subtitles found on OpenSubtitles.') };
      }
      const download = await doFetch(`${base}/download`, {
        method: 'POST',
        headers: { ...headers(current.apiKey, token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: best.fileId }),
      });
      const link = (await download.json().catch(() => ({}))) as { link?: string; remaining?: number; message?: string };
      if (download.status === 406 || (!link.link && link.remaining === 0))
        return { message: t('OpenSubtitles: the daily download limit is reached.') };
      if (!download.ok || !link.link) throw new Error(`download ${download.status}: ${link.message ?? ''}`);
      const file = await doFetch(link.link);
      if (!file.ok) throw new Error(`file ${file.status}`);
      const found: FoundSubtitle = {
        language: best.language,
        label: `${names[best.language]} · OpenSubtitles`,
        srt: await file.text(),
      };
      appLog.info('subtitles', `"${target.title}": ${best.language} subtitle downloaded (${link.remaining ?? '?'} downloads left today)`);
      await remember(key, found);
      return found;
    } catch (error) {
      appLog.warn('subtitles', `OpenSubtitles failed for "${target.title}": ${errorMessage(error)}`);
      return { message: t('OpenSubtitles could not be reached.') };
    }
  }

  return { settings, find };
}

export type SubtitleService = ReturnType<typeof createSubtitleService>;
export const isFoundSubtitle = (result: FoundSubtitle | SubtitleMiss): result is FoundSubtitle => 'srt' in result;
