import { requireNativeModule, requireNativeViewManager, type NativeModule } from 'expo-modules-core';
import type { ComponentType, Ref } from 'react';
import type { ExternalPlayerResult, NativeDownload, TvPlayerViewProps, TvPlayerViewRef } from './types-only';

export * from './types-only';

type TvMediaEvents = {
  onDownloadsChanged(event: { downloads: NativeDownload[] }): void;
  /** Phone-to-TV pairing: a request reached the TV's pairing server; answer with `respondPairing` (D-060). */
  onPairingRequest(event: { id: string; body: string }): void;
};

declare class TvMediaModule extends NativeModule<TvMediaEvents> {
  /** HTTP User-Agent for playback and downloads (persisted natively). */
  setUserAgent(userAgent: string): void;
  listDownloads(): NativeDownload[];
  /** True when the FFmpeg audio decoders are bundled in this build (D-059). */
  ffmpegAudioAvailable(): boolean;
  startDownload(id: string, uri: string, isHls: boolean, metadata: string): void;
  pauseDownload(id: string): void;
  resumeDownload(id: string): void;
  removeDownload(id: string): void;
  /** Removes every download (sign-out, account change). */
  removeAllDownloads(): void;
  /** Opens the stream in another video player app (D-057). */
  openExternalPlayer(uri: string, mimeType: string, title: string, headers: Record<string, string>): ExternalPlayerResult;
  /** TV: starts the pairing server on the home network (D-060). `host` is null when not connected. */
  startPairing(): { host: string | null; port: number; key: string };
  respondPairing(id: string, status: number, body: string): void;
  stopPairing(): void;
  /** Phone: scans a QR code with Google's code scanner; null when cancelled. */
  scanQrCode(): Promise<string | null>;
}

/** Media3 DownloadManager bridge (android/src/main/java/expo/modules/tvmedia/TvMediaModule.kt). */
export const TvMedia = requireNativeModule<TvMediaModule>('TvMedia');

/** ExoPlayer surface without built-in controls. */
export const TvPlayerView = requireNativeViewManager('TvMedia') as ComponentType<TvPlayerViewProps & { ref?: Ref<TvPlayerViewRef> }>;
