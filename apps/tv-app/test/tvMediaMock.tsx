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
  /** The native crash the last run left (D-113). */
  lastCrash: null as string | null,
  /** Phone-to-TV pairing (D-060): TV server state and what the phone's scanner returns. */
  pairingHost: '192.168.1.20' as string | null,
  pairingRunning: false,
  pairingListeners: new Set<PairingListener>(),
  pairingReplies: new Map<string, (reply: { status: number; body: string }) => void>(),
  scanResult: null as string | null,
  /** Remote play (D-061): the TV's remote server. */
  remoteRunning: false,
  remoteListeners: new Set<PairingListener>(),
  /** Delivers a request to the running remote server, like a paired phone would. */
  remoteRequest(body: string): Promise<{ status: number; body: string }> {
    const id = `remote-${this.pairingReplies.size + 1}-${Date.now()}`;
    return new Promise((resolve) => {
      this.pairingReplies.set(id, resolve);
      this.remoteListeners.forEach((listener) => listener({ id, body }));
    });
  },
  /** Self-update (D-062). */
  versionCode: 31,
  versionName: '1.0.0' as string | null,
  canInstall: true,
  updateVerdict: 'ok' as 'ok' | 'not-newer' | 'other-app' | 'other-key',
  updateListeners: new Set<(event: { bytes: number; total: number }) => void>(),
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
    this.lastCrash = null;
    this.pairingHost = '192.168.1.20';
    this.pairingRunning = false;
    this.pairingListeners.clear();
    this.pairingReplies.clear();
    this.scanResult = null;
    this.remoteRunning = false;
    this.remoteListeners.clear();
    this.versionCode = 31;
    this.versionName = '1.0.0';
    this.canInstall = true;
    this.updateVerdict = 'ok';
    this.updateListeners.clear();
  },
};

const lists = new Map<number, string>();
let nextListId = 1;

export const TvMedia = {
  setUserAgent: (userAgent: string) => void nativeState.calls.push(`user-agent:${userAgent}`),
  listDownloads: () => [...nativeState.downloads],
  ffmpegAudioAvailable: () => nativeState.ffmpegAudio,
  takeLastCrash: () => {
    const crash = nativeState.lastCrash;
    nativeState.lastCrash = null;
    return crash;
  },
  memoryInfo: () => ({
    javaHeapMaxMb: 192,
    javaHeapUsedMb: 20,
    memoryClassMb: 192,
    largeMemoryClassMb: 512,
    deviceRamMb: 1400,
    deviceFreeRamMb: 500,
    lowRamDevice: false,
  }),
  // Lists: fetched with the test's fetch and handed over whole (the shared client parses a whole array as well).
  openList: async (url: string, headers: Record<string, string>) => {
    const response = await globalThis.fetch(url, { headers });
    const id = nextListId++;
    lists.set(id, await response.text());
    return { id, status: response.status };
  },
  readList: async (id: number) => {
    const text = lists.get(id) ?? '';
    return { kind: 'whole' as const, text, chars: text.length };
  },
  closeList: (id: number) => void lists.delete(id),
  closeApp: async () => void nativeState.calls.push('close-app'),
  setKeepScreenOn: async (on: boolean) => void nativeState.calls.push(`keep-screen-on:${on}`),
  addListener: ((
    event: 'onDownloadsChanged' | 'onPairingRequest' | 'onRemoteRequest' | 'onUpdateProgress',
    listener: Listener | PairingListener | ((event: { bytes: number; total: number }) => void),
  ) => {
    const set = (
      event === 'onPairingRequest'
        ? nativeState.pairingListeners
        : event === 'onRemoteRequest'
          ? nativeState.remoteListeners
          : event === 'onUpdateProgress'
            ? nativeState.updateListeners
            : nativeState.listeners
    ) as Set<typeof listener>;
    set.add(listener);
    return { remove: () => set.delete(listener) };
  }) as {
    (event: 'onDownloadsChanged', listener: Listener): { remove(): void };
    (event: 'onPairingRequest' | 'onRemoteRequest', listener: PairingListener): { remove(): void };
    (event: 'onUpdateProgress', listener: (event: { bytes: number; total: number }) => void): { remove(): void };
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
  startRemote: (ports: number[]) => {
    nativeState.remoteRunning = true;
    return { host: nativeState.pairingHost, port: ports[0]! };
  },
  respondRemote: (id: string, status: number, body: string) => {
    nativeState.pairingReplies.get(id)?.({ status, body });
    nativeState.pairingReplies.delete(id);
  },
  stopRemote: () => {
    nativeState.remoteRunning = false;
  },
  randomKey: () => btoa(String.fromCharCode(...Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)))),
  deviceName: () => 'Living room TV',
  installedVersion: () => ({ versionCode: nativeState.versionCode, versionName: nativeState.versionName }),
  downloadUpdate: async (url: string, sha256: string | null) => {
    nativeState.calls.push(`update-download:${url}:${sha256}`);
    nativeState.updateListeners.forEach((listener) => listener({ bytes: 50, total: 100 }));
    return '/cache/updates/update.apk';
  },
  checkUpdate: () => nativeState.updateVerdict,
  canInstallUpdates: () => nativeState.canInstall,
  openInstallSettings: () => void nativeState.calls.push('update-settings'),
  installUpdate: async (path: string) => void nativeState.calls.push(`update-install:${path}`),
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
  subtitles: [] as { text: string; language: string; label: string }[],
  reset() {
    this.props = null;
    this.seeks = [];
    this.trackSelections = [];
    this.subtitles = [];
  },
};

export const TvPlayerView = forwardRef<TvPlayerViewRef, TvPlayerViewProps>(function TvPlayerView(props, ref) {
  playerState.props = props;
  useImperativeHandle(ref, () => ({
    seekTo: async (ms: number) => void playerState.seeks.push(ms),
    selectTrack: async (type: string, group: number, track: number) => void playerState.trackSelections.push(`${type}:${group}:${track}`),
    addSubtitle: async (text: string, language: string, label: string) => {
      playerState.subtitles.push({ text, language, label });
      return true;
    },
  }));
  return <View testID="tv-player-view" />;
});
