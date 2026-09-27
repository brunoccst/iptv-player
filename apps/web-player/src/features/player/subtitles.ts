import type Hls from 'hls.js';
import { t, type SubtitleChoice, type SubtitleTrackInfo } from '@iptv/shared';

/** The subtitle tracks of the playing stream: hls.js's, else the video element's own. */
export function subtitleTracks(hls: Hls | null, video: HTMLVideoElement | null): SubtitleTrackInfo[] {
  if (hls) {
    return hls.subtitleTracks.map((track) => ({
      language: track.lang ?? null,
      label: track.name || track.lang || t('Track {number}', { number: track.id }),
    }));
  }
  return video
    ? Array.from(video.textTracks).map((track) => ({ language: track.language || null, label: track.label || track.language }))
    : [];
}

/** The index of the subtitles on screen, or -1 when off. */
export function activeSubtitle(hls: Hls | null, video: HTMLVideoElement | null): number {
  if (hls) return hls.subtitleDisplay ? hls.subtitleTrack : -1;
  return video ? Array.from(video.textTracks).findIndex((track) => track.mode === 'showing') : -1;
}

/** Shows the subtitles at `index`, or none for -1. */
export function showSubtitle(hls: Hls | null, video: HTMLVideoElement | null, index: number): void {
  if (hls) {
    hls.subtitleDisplay = index >= 0;
    hls.subtitleTrack = index;
  } else if (video) {
    Array.from(video.textTracks).forEach((track, i) => (track.mode = i === index ? 'showing' : 'disabled'));
  }
}

/** What to keep for the series (D-087) when the viewer picks `index`. */
export function choiceOf(tracks: SubtitleTrackInfo[], index: number): SubtitleChoice {
  const track = tracks[index];
  return track ? { language: track.language, label: track.label } : { off: true };
}
