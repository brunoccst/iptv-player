import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import type { ExternalPlayerResult, NativeDownload, TvPlayerViewProps, TvPlayerViewRef } from '../modules/tv-media/src/types-only';

export type * from '../modules/tv-media/src/types-only';

type Listener = (event: { downloads: NativeDownload[] }) => void;
type PairingListener = (event: { id: string; body: string }) => void;
/** 32 fixed bytes, base64: the key the fake TV pairing server hands out. */
export const PAIRING_KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 1)));

/** In-memory stand-in for the native TvMedia module. Tests inspect `downloads` and `calls`. */
export const nativeState = {
  downloads: [] as NativeDownload[],
  listeners: new Set<Listener>(),
  calls: [] as string[],
  externalPlayerResult: 'chooser' as ExternalPlayerResult,
  ffmpegAudio: false,
  /** Phone-to-TV pairing (D-060): TV server state and what the phone's scanner returns. */
  pairingHost: '192.168.1.20' as string | null,
  pairingRunning: false,
  pairingListeners: new Set<PairingListener>(),
  pairingReplies: new Map<string, (reply: { status: number; body: string }) => void>(),
  scanResult: null as string | null,
  /** Delivers a request to the running pairing server, like a phone on the network would. */
  pairingRequest(body: string): Promise<{ status: number; body: string }> {
    const id = `req-${this.pairingReplies.size + 1}-${Date.now()}`;
    return new Promise((resolve) => {
      this.pairingReplies.set(id, resolve);
      this.pairingListeners.forEach((listener) => listener({ id, body }));
    });
  },
  emit() {
    this.listeners.forEach((listener) => listener({ downloads: [...this.downloads] }));
  },
  reset() {
    this.downloads = [];
    this.calls = [];
    this.externalPlayerResult = 'chooser';
    this.ffmpegAudio = false;
    this.pairingHost = '192.168.1.20';
    this.pairingRunning = false;
    this.pairingListeners.clear();
    this.pairingReplies.clear();
    this.scanResult = null;
  },
};

export const TvMedia = {
  setUserAgent: (userAgent: string) => void nativeState.calls.push(`user-agent:${userAgent}`),
  listDownloads: () => [...nativeState.downloads],
  ffmpegAudioAvailable: () => nativeState.ffmpegAudio,
  addListener: ((event: 'onDownloadsChanged' | 'onPairingRequest', listener: Listener | PairingListener) => {
    const set = (event === 'onPairingRequest' ? nativeState.pairingListeners : nativeState.listeners) as Set<typeof listener>;
    set.add(listener);
    return { remove: () => set.delete(listener) };
  }) as {
    (event: 'onDownloadsChanged', listener: Listener): { remove(): void };
    (event: 'onPairingRequest', listener: PairingListener): { remove(): void };
  },
  startPairing: () => {
    nativeState.pairingRunning = true;
    nativeState.calls.push('pairing-start');
    return { host: nativeState.pairingHost, port: 38123, key: PAIRING_KEY };
  },
  respondPairing: (id: string, status: number, body: string) => {
    nativeState.pairingReplies.get(id)?.({ status, body });
    nativeState.pairingReplies.delete(id);
  },
  stopPairing: () => {
    nativeState.pairingRunning = false;
    nativeState.calls.push('pairing-stop');
  },
  scanQrCode: async () => nativeState.scanResult,
  startDownload: (id: string, uri: string, isHls: boolean, metadata: string) => {
    nativeState.calls.push(`start:${id}:${uri}:${isHls}`);
    nativeState.downloads.push({ id, state: 'queued', percent: 0, bytesDownloaded: 0, metadata, failureReason: 0 });
  },
  pauseDownload: (id: string) => nativeState.calls.push(`pause:${id}`),
  resumeDownload: (id: string) => nativeState.calls.push(`resume:${id}`),
  removeDownload: (id: string) => {
    nativeState.calls.push(`remove:${id}`);
    nativeState.downloads = nativeState.downloads.filter((d) => d.id !== id);
  },
  removeAllDownloads: () => {
    nativeState.calls.push('remove-all');
    nativeState.downloads = [];
  },
  openExternalPlayer: (uri: string, mimeType: string, title: string, headers: Record<string, string>) => {
    nativeState.calls.push(`external:${uri}:${mimeType}:${title}:${JSON.stringify(headers)}`);
    return nativeState.externalPlayerResult;
  },
};

/** Latest props + ref calls of the mounted TvPlayerView. */
export const playerState = {
  props: null as TvPlayerViewProps | null,
  seeks: [] as number[],
  trackSelections: [] as string[],
  reset() {
    this.props = null;
    this.seeks = [];
    this.trackSelections = [];
  },
};

export const TvPlayerView = forwardRef<TvPlayerViewRef, TvPlayerViewProps>(function TvPlayerView(props, ref) {
  playerState.props = props;
  useImperativeHandle(ref, () => ({
    seekTo: async (ms: number) => void playerState.seeks.push(ms),
    selectTrack: async (type: string, group: number, track: number) => void playerState.trackSelections.push(`${type}:${group}:${track}`),
  }));
  return <View testID="tv-player-view" />;
});
