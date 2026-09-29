import type Hls from 'hls.js';
import { t, type SubtitleChoice, type TrackInfo } from '@iptv/shared';

/** The `<track>` id of a subtitle added from OpenSubtitles (D-111). */
export const ADDED_TRACK_ID = 'opensubtitles';

/** The subtitle added from OpenSubtitles, if any; with hls.js it comes after the stream's own. */
const addedTrack = (video: HTMLVideoElement | null) =>
  video ? (Array.from(video.textTracks).find((track) => track.id === ADDED_TRACK_ID) ?? null) : null;

/** The subtitle tracks of the playing stream: hls.js's, else the video element's own. Audio: `audioTracks`. */
export function subtitleTracks(hls: Hls | null, video: HTMLVideoElement | null): TrackInfo[] {
  if (hls) {
    const added = addedTrack(video);
    return [
      ...hls.subtitleTracks.map((track) => ({
        language: track.lang ?? null,
        label: track.name || track.lang || t('Track {number}', { number: track.id }),
      })),
      ...(added ? [{ language: added.language || null, label: added.label }] : []),
    ];
  }
  return video
    ? Array.from(video.textTracks).map((track) => ({ language: track.language || null, label: track.label || track.language }))
    : [];
}

/** The index of the subtitles on screen, or -1 when off. */
export function activeSubtitle(hls: Hls | null, video: HTMLVideoElement | null): number {
  if (hls && addedTrack(video)?.mode === 'showing') return hls.subtitleTracks.length;
  if (hls) return hls.subtitleDisplay ? hls.subtitleTrack : -1;
  return video ? Array.from(video.textTracks).findIndex((track) => track.mode === 'showing') : -1;
}

/** Shows the subtitles at `index`, or none for -1. */
export function showSubtitle(hls: Hls | null, video: HTMLVideoElement | null, index: number): void {
  if (hls) {
    const own = hls.subtitleTracks.length;
    const added = addedTrack(video);
    if (added) added.mode = index === own ? 'showing' : 'disabled';
    hls.subtitleDisplay = index >= 0 && index < own;
    hls.subtitleTrack = index < own ? index : -1;
  } else if (video) {
    Array.from(video.textTracks).forEach((track, i) => (track.mode = i === index ? 'showing' : 'disabled'));
  }
}

/** What to keep (D-087) when the viewer picks subtitles `index`. */
export function choiceOf(tracks: TrackInfo[], index: number): SubtitleChoice {
  const track = tracks[index];
  return track ? { language: track.language, label: track.label } : { off: true };
}

/** The audio tracks hls.js lists (a plain file plays its default audio). */
export function audioTracks(hls: Hls | null): TrackInfo[] {
  return (hls?.audioTracks ?? []).map((track, index) => ({
    language: track.lang ?? null,
    label: track.name || track.lang || t('Track {number}', { number: index + 1 }),
  }));
}

/** Adds a WebVTT subtitle (from OpenSubtitles, D-111) to the video and shows it instead of the stream's own. */
export function addSubtitle(hls: Hls | null, video: HTMLVideoElement, vtt: string, language: string, label: string): void {
  removeAddedSubtitle(video);
  const element = document.createElement('track');
  element.id = ADDED_TRACK_ID;
  element.kind = 'subtitles';
  element.label = label;
  element.srclang = language;
  element.src = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
  video.appendChild(element);
  showSubtitle(
    hls,
    video,
    hls ? hls.subtitleTracks.length : Array.from(video.textTracks).findIndex((track) => track.id === ADDED_TRACK_ID),
  );
}

export function removeAddedSubtitle(video: HTMLVideoElement): void {
  video.querySelectorAll<HTMLTrackElement>(`track#${ADDED_TRACK_ID}`).forEach((element) => {
    URL.revokeObjectURL(element.src);
    element.remove();
  });
}
