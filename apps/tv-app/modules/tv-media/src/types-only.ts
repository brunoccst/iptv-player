import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeDownloadState = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'removing' | 'unknown';

export interface NativeDownload {
  id: string;
  state: NativeDownloadState;
  /** 0..100, null when unknown. */
  percent: number | null;
  bytesDownloaded: number;
  /** Opaque JSON passed to `startDownload`. */
  metadata: string;
  failureReason: number;
}

export interface PlayerSource {
  uri?: string | null;
  offlineId?: string | null;
  isHls?: boolean;
  startPositionMs?: number;
  /** Which audio decoders the player tries first (D-059). */
  audioDecoder?: AudioDecoderChoice;
}

/** `device` (default): the device's decoders first, FFmpeg for the rest; `ffmpeg`: FFmpeg first. */
export type AudioDecoderChoice = 'device' | 'ffmpeg';

export interface PlayerStatusEvent {
  state: 'idle' | 'buffering' | 'ready' | 'ended';
  isPlaying: boolean;
  /** The player paused itself because the headphones or Bluetooth headset went away (#83). */
  pausedByAudioOutput?: boolean;
}

export interface PlayerProgressEvent {
  positionMs: number;
  durationMs: number;
  bufferedMs: number;
  isLive: boolean;
}

export interface PlayerTrack {
  type: 'audio' | 'text';
  groupIndex: number;
  trackIndex: number;
  label: string;
  language: string | null;
  selected: boolean;
}

export interface TvPlayerViewProps extends ViewProps {
  source: PlayerSource | null;
  paused: boolean;
  onStatus?(event: NativeSyntheticEvent<PlayerStatusEvent>): void;
  onProgress?(event: NativeSyntheticEvent<PlayerProgressEvent>): void;
  onTracks?(event: NativeSyntheticEvent<{ tracks: PlayerTrack[] }>): void;
  onEnd?(event: NativeSyntheticEvent<Record<string, never>>): void;
  onError?(event: NativeSyntheticEvent<{ message: string; code: string; detail?: string }>): void;
}

export interface TvPlayerViewRef {
  seekTo(positionMs: number): Promise<void>;
  /** `groupIndex` -1 turns text tracks off. */
  selectTrack(type: 'audio' | 'text', groupIndex: number, trackIndex: number): Promise<void>;
  /** Adds a SubRip subtitle to the streamed title and turns it on (D-111); false for downloads. */
  addSubtitle(text: string, language: string, label: string): Promise<boolean>;
}

/** `opened`: a default player took the stream; `chooser`: the system app chooser was shown; `none`: no player app. */
export type ExternalPlayerResult = 'opened' | 'chooser' | 'none';

/** What Android would say about a downloaded update (D-062): `other-key` means a different signing key. */
export type UpdateCheck = 'ok' | 'not-newer' | 'other-app' | 'other-key';

/** What the app may use and the device has, in MB (D-113). */
export interface MemoryInfo {
  javaHeapMaxMb: number;
  javaHeapUsedMb: number;
  memoryClassMb: number;
  largeMemoryClassMb: number;
  deviceRamMb: number;
  deviceFreeRamMb: number;
  lowRamDevice: boolean;
}

/** A piece of a provider list read natively (D-115); the same shape as `ListPiece` in @iptv/shared. */
export type ListPiece =
  | { kind: 'batch'; text: string }
  | { kind: 'end'; chars: number }
  | { kind: 'whole'; text: string; chars: number }
  | { kind: 'incomplete'; text: string; chars: number }
  | { kind: 'error'; message: string };
