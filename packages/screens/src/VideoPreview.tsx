import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  type LiveChannel,
  type EpgListing,
  t,
  tvPlaybackAttempts,
  webPlaybackAttempts,
  type PlaybackInfoWithAlternates,
} from '@iptv/shared';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';
import { useScreenHost } from './host';

interface VideoPreviewProps {
  channel: LiveChannel | null;
  _programme: EpgListing | null;
  categoryName: string;
  onPlay?: () => void;
}

const RESOLUTION_TEXT = '1920 × 1080';

/**
 * Video preview component - shows live stream preview in a 16:9 container.
 * TV: uses native TvPlayerView. Web: uses HTML5 video with HLS.js.
 */
export function VideoPreview({ channel, _programme, categoryName, onPlay }: VideoPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const isTV = Platform.isTV;
  const host = useScreenHost();
  const { api, providerUserAgent } = host;

  if (!channel) {
    return (
      <View style={styles.videoPreview} testID="video-preview">
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderText}>{t('Select a channel')}</Text>
        </View>
        <View style={styles.videoOverlay} pointerEvents="none">
          <View style={styles.overlayLeft}>
            <Text style={styles.overlayChannelName}>{t('No channel selected')}</Text>
            <Text style={styles.overlayCategory}>{categoryName}</Text>
          </View>
        </View>
      </View>
    );
  }

  // Platform-specific video player
  const VideoPlayer = isTV ? TvVideoPlayer : WebVideoPlayer;

  return (
    <View style={styles.videoPreview} testID="video-preview">
      <VideoPlayer
        channel={channel}
        api={api}
        _providerUserAgent={providerUserAgent}
        onError={setError}
        style={styles.videoPlayer}
        isTV={isTV}
      />
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
          {onPlay && (
            <FocusButton
              label={t('Watch live')}
              variant="primary"
              style={styles.previewPlayButton}
              onPress={onPlay}
              testID="preview-play-button"
            />
          )}
        </View>
      )}
      <View style={styles.videoOverlay} pointerEvents="none">
        <View style={styles.overlayLeft}>
          <Text style={styles.overlayChannelName}>{channel.name}</Text>
          <Text style={styles.overlayCategory}>{categoryName}</Text>
        </View>
        <View style={styles.overlayRight}>
          <Text style={styles.overlayMeta}>
            {channel.number != null ? `N° ${channel.number}  •  ` : ''}
            {RESOLUTION_TEXT}
          </Text>
        </View>
      </View>
    </View>
  );
}

// TV native video player using TvPlayerView
interface TvVideoPlayerProps {
  channel: LiveChannel;
  api: ReturnType<typeof useScreenHost>['api'];
  _providerUserAgent: string;
  onError: (msg: string) => void;
  style?: ViewStyle;
  isTV: boolean;
}

function TvVideoPlayer({ channel, api, _providerUserAgent, onError, style, isTV }: TvVideoPlayerProps) {
  const playerRef = useRef<unknown>(null);
  const [source, setSource] = useState<{ uri: string; isHls: boolean; startPositionMs: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const alternates = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadSource = async () => {
      try {
        const plan = tvPlaybackAttempts('live', 'm3u8');
        const step = plan[attempt];
        if (!step) {
          onError('No playable source available');
          return;
        }

        const info = (await api.playback.get('live', channel.id, step.container, undefined, {
          catchup: null,
        })) as PlaybackInfoWithAlternates;
        if (cancelled) return;

        alternates.current = [...(info.alternateUrls ?? [])];
        setSource({ uri: info.url, isHls: step.engine === 'hls', startPositionMs: 0 });
      } catch (err) {
        if (cancelled) return;
        if (attempt < 2) {
          setAttempt((a) => a + 1);
        } else {
          onError(`Failed to load stream: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    };
    loadSource();
    return () => {
      cancelled = true;
    };
  }, [channel.id, attempt, api, onError]);

  if (!source) {
    return (
      <View style={[styles.videoPlaceholder, style]}>
        <Text style={styles.placeholderText}>{t('Loading…')}</Text>
      </View>
    );
  }

  // Dynamic import for TvPlayerView - only available on TV (react-native-tvos)
  // Using a function to avoid static analysis of the require path
  const getTvPlayerView = () => {
    if (!isTV) return () => null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(['.', '.', 'modules', 'tv-media'].join('/'));
    return mod.TvPlayerView;
  };
  const TvPlayerView = getTvPlayerView();

  return (
    <TvPlayerView
      ref={playerRef}
      style={[StyleSheet.absoluteFill, style]}
      source={source}
      paused={false}
      onStatus={(e: { nativeEvent: { state: string } }) => {
        const state = e.nativeEvent.state;
        if (state === 'error') {
          onError('Playback error');
        }
      }}
      onError={(e: { nativeEvent: { message: string; code: string } }) => {
        const { message, code } = e.nativeEvent;
        // Try alternate URL on network error
        if (code.startsWith('ERROR_CODE_IO') && alternates.current.length > 0) {
          const nextUrl = alternates.current.shift();
          if (nextUrl) {
            setSource({ ...source, uri: nextUrl });
          }
        } else {
          onError(message);
        }
      }}
    />
  );
}

// Web video player using HTML5 video with HLS.js
interface WebVideoPlayerProps {
  channel: LiveChannel;
  api: ReturnType<typeof useScreenHost>['api'];
  _providerUserAgent: string;
  onError: (msg: string) => void;
  style?: ViewStyle;
}

function WebVideoPlayer({ channel, api, _providerUserAgent, onError, style }: WebVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const alternates = useRef<string[]>([]);
  const hlsRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let hls: unknown = null;

    const loadSource = async () => {
      try {
        const plan = webPlaybackAttempts('live', 'm3u8');
        const step = plan[attempt];
        if (!step) {
          onError('No playable source available');
          return;
        }

        const info = (await api.playback.get('live', channel.id, step.container, undefined, {
          catchup: null,
        })) as PlaybackInfoWithAlternates;
        if (cancelled) return;

        alternates.current = [...(info.alternateUrls ?? [])];

        const video = videoRef.current;
        if (!video) return;

        // Clean up previous HLS instance
        if (hlsRef.current) {
          (hlsRef.current as { destroy: () => void }).destroy();
          hlsRef.current = null;
        }

        const url = info.url;
        if (step.engine === 'hls' && typeof window !== 'undefined') {
          // Load HLS.js dynamically
          const HlsModule = await import('hls.js');
          const Hls = HlsModule.default;
          if (Hls.isSupported()) {
            hls = new Hls({ enableWorker: true, backBufferLength: 60, maxBufferLength: 30 });
            hlsRef.current = hls;
            (hls as { loadSource: (url: string) => void; attachMedia: (media: HTMLVideoElement) => void }).loadSource(url);
            (hls as { attachMedia: (media: HTMLVideoElement) => void }).attachMedia(video);
            (hls as { on: (event: string, callback: () => void) => void }).on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => {}); // Muted autoplay
            });
            (hls as { on: (event: string, callback: (event: unknown, data: { fatal: boolean; type: string }) => void) => void }).on(
              Hls.Events.ERROR,
              (_event: unknown, data: { fatal: boolean; type: string }) => {
                if (data.fatal) {
                  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    (hls as { startLoad: () => void }).startLoad();
                  } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    (hls as { recoverMediaError: () => void }).recoverMediaError();
                  } else {
                    (hls as { destroy: () => void }).destroy();
                    hlsRef.current = null;
                    tryAlternate();
                  }
                }
              },
            );
            setSrc(url);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS (Safari)
            video.src = url;
            video.play().catch(() => {});
            setSrc(url);
          } else {
            tryAlternate();
          }
        } else {
          // Direct video
          video.src = url;
          video.play().catch(() => {});
          setSrc(url);
        }
      } catch (err) {
        if (cancelled) return;
        tryAlternate();
      }
    };

    const tryAlternate = () => {
      if (alternates.current.length > 0) {
        alternates.current.shift();
        // In a real implementation, we'd re-try with the alternate URL
        // For simplicity, just show error
        onError('Failed to load stream');
      } else if (attempt < 2) {
        setAttempt((a) => a + 1);
      } else {
        onError('Failed to load stream after multiple attempts');
      }
    };

    loadSource();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        (hlsRef.current as { destroy: () => void }).destroy();
        hlsRef.current = null;
      }
    };
  }, [channel.id, attempt, api, onError]);

  return (
    <View style={[styles.videoPlayer, style]}>
      <video ref={videoRef} style={StyleSheet.absoluteFill} muted playsInline autoPlay />
      {!src && (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderText}>{t('Loading…')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  videoPreview: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  placeholderText: { color: colors.muted, fontSize: fonts.body },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
  },
  errorText: { color: colors.warning, fontSize: fonts.small, textAlign: 'center', marginBottom: 12 },
  previewPlayButton: { width: 180 },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  overlayLeft: { flexDirection: 'column', gap: 2 },
  overlayRight: { alignItems: 'flex-end' },
  overlayChannelName: {
    color: colors.strong,
    fontSize: fonts.body,
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayCategory: {
    color: colors.muted,
    fontSize: fonts.tiny,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayMeta: {
    color: colors.text,
    fontSize: fonts.tiny,
    fontWeight: '500',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
