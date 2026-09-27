import type { ProfilePrefs, ProfilePrefsStore } from '../stores/profilePrefsStore';

/**
 * The subtitles picked in a series, kept for its next episodes (D-087): off, or a track by its language and name.
 * Episodes carry their own track lists, so a choice is matched again by language and name, never by position.
 */
export type SubtitleChoice = { off: true } | { off?: false; language: string | null; label: string };

/** A subtitle track as a player lists it. */
export interface SubtitleTrackInfo {
  language: string | null;
  label: string;
}

/** Series kept per profile; the oldest choice goes first. */
export const MAX_SUBTITLE_CHOICES = 100;

/** The series an episode belongs to, across its versions (the master id), or null for movies and live channels. */
export function subtitleKey(target: { kind: string; masterId?: string | null; seriesId?: string | null }): string | null {
  if (target.kind !== 'episode') return null;
  return target.masterId || target.seriesId || null;
}

export function rememberedSubtitle(prefs: ProfilePrefs | undefined, key: string | null): SubtitleChoice | null {
  return key ? (prefs?.subtitles?.[key] ?? null) : null;
}

/** The profile's choices with this one added as the newest. */
export function withSubtitleChoice(prefs: ProfilePrefs | undefined, key: string, choice: SubtitleChoice): Record<string, SubtitleChoice> {
  const rest = Object.entries(prefs?.subtitles ?? {}).filter(([k]) => k !== key);
  return Object.fromEntries([...rest.slice(-(MAX_SUBTITLE_CHOICES - 1)), [key, choice]]);
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a) && Boolean(b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();

/**
 * The track to show for a remembered choice: -1 for off; else the index of the track with the same language and
 * name, then the same language, then the same name. Null when nothing matches (the player keeps its default).
 */
export function pickSubtitle(tracks: SubtitleTrackInfo[], choice: SubtitleChoice | null): number | null {
  if (!choice) return null;
  if (choice.off) return -1;
  const both = tracks.findIndex((track) => same(track.language, choice.language) && same(track.label, choice.label));
  if (both >= 0) return both;
  const language = tracks.findIndex((track) => same(track.language, choice.language));
  if (language >= 0) return language;
  const label = tracks.findIndex((track) => same(track.label, choice.label));
  return label >= 0 ? label : null;
}

interface ChoiceStores {
  session: { getState(): { activeProfileId: string | null } };
  profilePrefs: ProfilePrefsStore;
}

/** The open profile's choice for this episode's series, or null. */
export function subtitleChoiceFor(stores: ChoiceStores, target: Parameters<typeof subtitleKey>[0]): SubtitleChoice | null {
  const profileId = stores.session.getState().activeProfileId;
  return profileId ? rememberedSubtitle(stores.profilePrefs.getState().prefs[profileId], subtitleKey(target)) : null;
}

/** Keeps a choice made in the player for the series' next episodes (movies and live channels are not kept). */
export function rememberSubtitle(stores: ChoiceStores, target: Parameters<typeof subtitleKey>[0], choice: SubtitleChoice): void {
  const profileId = stores.session.getState().activeProfileId;
  const key = subtitleKey(target);
  if (!profileId || !key) return;
  const prefs = stores.profilePrefs.getState().prefs[profileId];
  void stores.profilePrefs.getState().update(profileId, { subtitles: withSubtitleChoice(prefs, key, choice) });
}
