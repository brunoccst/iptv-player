import { requireNativeModule, requireNativeViewManager, type NativeModule } from 'expo-modules-core';
import type { ComponentType, Ref } from 'react';
import type {
  ExternalPlayerResult,
  ListPiece,
  MemoryInfo,
  NativeDownload,
  TvPlayerViewProps,
  TvPlayerViewRef,
  UpdateCheck,
} from './types-only';

export * from './types-only';

type TvMediaEvents = {
  onDownloadsChanged(event: { downloads: NativeDownload[] }): void;
  /** Phone-to-TV pairing: a request reached the TV's pairing server; answer with `respondPairing` (D-060). */
  onPairingRequest(event: { id: string; body: string }): void;
  /** Remote play: a paired phone sent a command; answer with `respondRemote` (D-061). */
  onRemoteRequest(event: { id: string; body: string }): void;
  /** Self-update download progress (D-062). `total` is -1 when unknown. */
  onUpdateProgress(event: { bytes: number; total: number }): void;
};

declare class TvMediaModule extends NativeModule<TvMediaEvents> {
  /** HTTP User-Agent for playback and downloads (persisted natively). */
  setUserAgent(userAgent: string): void;
  listDownloads(): NativeDownload[];
  /** True when the FFmpeg audio decoders are bundled in this build (D-059). */
  ffmpegAudioAvailable(): boolean;
  /** The native crash of the last run (stack trace), once; null when it ended normally (D-113). */
  takeLastCrash(): string | null;
  /** Java heap limit and use, and the device's RAM, in MB (D-113). */
  memoryInfo(): MemoryInfo;
  /** Provider lists read on a background thread (D-115); see `ListReader` in @iptv/shared. */
  openList(url: string, headers: Record<string, string>, timeoutMs: number, batchChars: number): Promise<{ id: number; status: number }>;
  readList(id: number): Promise<ListPiece>;
  closeList(id: number): void;
  /** SHA-1 hex digests of plain-ASCII texts separated by "\n", one after another (D-118). */
  sha1Batch(texts: string): Promise<string>;
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
  /** TV: starts the remote-play server on the first free port of `ports` (D-061). */
  startRemote(ports: number[]): { host: string | null; port: number };
  respondRemote(id: string, status: number, body: string): void;
  stopRemote(): void;
  /** 32 random bytes (SecureRandom), base64. */
  randomKey(): string;
  /** The device's name from Settings, else its model. */
  deviceName(): string;
  /** Closes the app like "Force stop": leaves the recent apps and ends the process. */
  closeApp(): Promise<void>;
  /** Keeps the screen on while the app is open (sleep mode, D-068). */
  setKeepScreenOn(on: boolean): Promise<void>;
  /** Self-update (D-062). */
  installedVersion(): { versionCode: number; versionName: string | null };
  downloadUpdate(url: string, sha256: string | null): Promise<string>;
  checkUpdate(path: string): UpdateCheck;
  canInstallUpdates(): boolean;
  openInstallSettings(): void;
  /** Opens the Android installer on top of the app (D-070). */
  installUpdate(path: string): Promise<void>;
  /** Phone: scans a QR code with Google's code scanner; null when cancelled. */
  scanQrCode(): Promise<string | null>;
}

/** Media3 DownloadManager bridge (android/src/main/java/expo/modules/tvmedia/TvMediaModule.kt). */
export const TvMedia = requireNativeModule<TvMediaModule>('TvMedia');

/** ExoPlayer surface without built-in controls. */
export const TvPlayerView = requireNativeViewManager('TvMedia') as ComponentType<TvPlayerViewProps & { ref?: Ref<TvPlayerViewRef> }>;
