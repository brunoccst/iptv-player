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
}

export interface PlayerStatusEvent {
  state: 'idle' | 'buffering' | 'ready' | 'ended';
  isPlaying: boolean;
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
  onError?(event: NativeSyntheticEvent<{ message: string; code: string }>): void;
}

export interface TvPlayerViewRef {
  seekTo(positionMs: number): Promise<void>;
  /** `groupIndex` -1 turns text tracks off. */
  selectTrack(type: 'audio' | 'text', groupIndex: number, trackIndex: number): Promise<void>;
}
