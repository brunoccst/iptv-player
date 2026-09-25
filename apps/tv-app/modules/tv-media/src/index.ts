import { requireNativeModule, requireNativeViewManager, type NativeModule } from 'expo-modules-core';
import type { ComponentType, Ref } from 'react';
import type { ExternalPlayerResult, NativeDownload, TvPlayerViewProps, TvPlayerViewRef } from './types-only';

export * from './types-only';

type TvMediaEvents = {
  onDownloadsChanged(event: { downloads: NativeDownload[] }): void;
};

declare class TvMediaModule extends NativeModule<TvMediaEvents> {
  /** HTTP User-Agent for playback and downloads (persisted natively). */
  setUserAgent(userAgent: string): void;
  listDownloads(): NativeDownload[];
  startDownload(id: string, uri: string, isHls: boolean, metadata: string): void;
  pauseDownload(id: string): void;
  resumeDownload(id: string): void;
  removeDownload(id: string): void;
  /** Removes every download (sign-out, account change). */
  removeAllDownloads(): void;
  /** Opens the stream in another video player app (D-057). */
  openExternalPlayer(uri: string, mimeType: string, title: string, headers: Record<string, string>): ExternalPlayerResult;
}

/** Media3 DownloadManager bridge (android/src/main/java/expo/modules/tvmedia/TvMediaModule.kt). */
export const TvMedia = requireNativeModule<TvMediaModule>('TvMedia');

/** ExoPlayer surface without built-in controls. */
export const TvPlayerView = requireNativeViewManager('TvMedia') as ComponentType<TvPlayerViewProps & { ref?: Ref<TvPlayerViewRef> }>;
