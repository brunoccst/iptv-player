import type { VariantInfo } from '../api/types';
import { LANGUAGE_LONG, LANGUAGE_SHORT } from '../direct/normalizer/tags';
import { intlLocale } from '../i18n/i18n';
import { languageNames, type ProfilePrefs, type ProfilePrefsStore } from '../stores/profilePrefsStore';

/**
 * The profile's playback choices (D-087): the subtitles, the audio track and the version last picked are what every
 * movie and series starts with. Titles list their own tracks and versions, so a choice is matched again by language
 * (and name or quality), never by position.
 */

/** A player track by its language and name. */
export interface TrackChoice {
  language: string | null;
  label: string;
}

/** Subtitles: off, or a track. */
export type SubtitleChoice = { off: true } | ({ off?: false } & TrackChoice);

/** A version by its audio languages (`['ENG']`) and quality (`'4K'`). */
export interface VersionChoice {
  languages: string[];
  quality: string | null;
}

export interface PlaybackChoices {
  subtitles?: SubtitleChoice | null;
  audio?: TrackChoice | null;
  version?: VersionChoice | null;
}

/** A track as a player lists it. */
export type TrackInfo = TrackChoice;

/** Movies and episodes start with the choices; live channels keep what the stream sends. */
export const usesPlaybackChoices = (target: { kind: string }) => target.kind !== 'live';

const same = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a) && Boolean(b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();

/**
 * The track to show for a choice: -1 for subtitles off; else the index of the track with the same language and name,
 * then the same language, then the same name. Null when nothing matches (the player keeps its default).
 */
export function pickTrack(tracks: TrackInfo[], choice: SubtitleChoice | TrackChoice | null | undefined): number | null {
  if (!choice) return null;
  if ('off' in choice && choice.off) return -1;
  const { language, label } = choice as TrackChoice;
  const both = tracks.findIndex((track) => same(track.language, language) && same(track.label, label));
  if (both >= 0) return both;
  const byLanguage = tracks.findIndex((track) => same(track.language, language));
  if (byLanguage >= 0) return byLanguage;
  const byLabel = tracks.findIndex((track) => same(track.label, label));
  return byLabel >= 0 ? byLabel : null;
}

/** What to keep when a version is picked. */
export const versionChoiceOf = (variant: Pick<VariantInfo, 'audioLanguages' | 'quality'>): VersionChoice => ({
  languages: [...variant.audioLanguages],
  quality: variant.quality ?? null,
});

/**
 * The version a title starts with when none was picked for it: one in the chosen language, the same quality first;
 * without a language, the same quality. Null = the default (the best, listed first).
 */
export function preferredVariant<V extends Pick<VariantInfo, 'audioLanguages' | 'quality'>>(
  variants: V[],
  choice: VersionChoice | null | undefined,
): V | null {
  if (!choice) return null;
  const sameQuality = (variant: V) => same(variant.quality, choice.quality);
  const candidates = choice.languages.length
    ? variants.filter((variant) => variant.audioLanguages.some((language) => choice.languages.some((wanted) => same(language, wanted))))
    : variants;
  if (candidates.length === 0) return null;
  return candidates.find(sameQuality) ?? (choice.languages.length ? candidates[0]! : null);
}

interface ChoiceStores {
  session: { getState(): { activeProfileId: string | null } };
  profilePrefs: ProfilePrefsStore;
}

export const playbackChoicesOf = (prefs: ProfilePrefs | undefined): PlaybackChoices => prefs?.playback ?? {};

/** The open profile's choices. */
export function playbackChoices(stores: ChoiceStores): PlaybackChoices {
  const profileId = stores.session.getState().activeProfileId;
  return profileId ? playbackChoicesOf(stores.profilePrefs.getState().prefs[profileId]) : {};
}

/** Keeps a choice made in the player or in details for the open profile. */
export function rememberPlayback(stores: ChoiceStores, patch: PlaybackChoices): void {
  const profileId = stores.session.getState().activeProfileId;
  if (!profileId) return;
  const current = playbackChoicesOf(stores.profilePrefs.getState().prefs[profileId]);
  void stores.profilePrefs.getState().update(profileId, { playback: { ...current, ...patch } });
}

/** A version picked in details or in the player: used for this title and kept as the profile's version choice. */
export function chooseVersion(
  stores: ChoiceStores & { library: { getState(): { selectVariant(masterId: string, streamId: string): void } } },
  masterId: string,
  variant: Pick<VariantInfo, 'streamId' | 'audioLanguages' | 'quality'>,
): void {
  stores.library.getState().selectVariant(masterId, variant.streamId);
  rememberPlayback(stores, { version: versionChoiceOf(variant) });
}

/**
 * The language of a track code ("en", "eng", "de", "pt-BR"…) in the app's language: "English", "Inglês"… Our own
 * language names first, then the platform's (`Intl.DisplayNames`); null when neither knows it.
 */
export function trackLanguageName(code: string | null | undefined): string | null {
  const tag = code?.trim();
  if (!tag || tag.toLowerCase() === 'und') return null;
  const base = tag.toLowerCase().split(/[-_]/)[0]!;
  const ours = LANGUAGE_LONG[base] ?? LANGUAGE_SHORT[base];
  if (ours && languageNames()[ours]) return languageNames()[ours]!;
  try {
    const name = new Intl.DisplayNames([intlLocale()], { type: 'language' }).of(tag);
    return name && name.toLowerCase() !== tag.toLowerCase() ? name : null;
  } catch {
    return null;
  }
}

/**
 * What a player shows for a track: the stream's own name ("English 5.1", "Forced"), or, when it has none or only
 * repeats the language code ("en"), the language's name (D-089).
 */
export function trackLabel(track: TrackInfo): string {
  const label = track.label?.trim() ?? '';
  const language = track.language?.trim() ?? '';
  if (label && label.toLowerCase() !== language.toLowerCase()) return label;
  return trackLanguageName(language) ?? (label || language);
}
