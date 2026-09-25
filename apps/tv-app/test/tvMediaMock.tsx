import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import type { ExternalPlayerResult, NativeDownload, TvPlayerViewProps, TvPlayerViewRef } from '../modules/tv-media/src/types-only';

export type * from '../modules/tv-media/src/types-only';

type Listener = (event: { downloads: NativeDownload[] }) => void;

/** In-memory stand-in for the native TvMedia module. Tests inspect `downloads` and `calls`. */
export const nativeState = {
  downloads: [] as NativeDownload[],
  listeners: new Set<Listener>(),
  calls: [] as string[],
  externalPlayerResult: 'chooser' as ExternalPlayerResult,
  emit() {
    this.listeners.forEach((listener) => listener({ downloads: [...this.downloads] }));
  },
  reset() {
    this.downloads = [];
    this.calls = [];
    this.externalPlayerResult = 'chooser';
  },
};

export const TvMedia = {
  setUserAgent: (userAgent: string) => void nativeState.calls.push(`user-agent:${userAgent}`),
  listDownloads: () => [...nativeState.downloads],
  addListener: (_event: 'onDownloadsChanged', listener: Listener) => {
    nativeState.listeners.add(listener);
    return { remove: () => nativeState.listeners.delete(listener) };
  },
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
