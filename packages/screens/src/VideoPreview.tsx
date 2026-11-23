import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle, type ViewProps, useWindowDimensions } from 'react-native';
import {
  type LiveChannel,
  type EpgListing,
  t,
  tvPlaybackAttempts,
  webPlaybackAttempts,
  type PlaybackInfoWithAlternates,
  catchupMode,
} from '@iptv/shared';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';
import { useScreenHost } from './host';
import { useNow } from '@iptv/shared/react';

// TvPlayerView types (from apps/tv-app/modules/tv-media/src/types-only.ts)
interface PlayerSource {
  uri?: string | null;
  isHls?: boolean;
  startPositionMs?: number;
}

interface PlayerStatusEvent {
  state: 'idle' | 'buffering' | 'ready' | 'ended' | 'error';
}

interface PlayerErrorEvent {
  message: string;
  code: string;
}

interface TvPlayerViewRef {
  seekTo(positionMs: number): Promise<void>;
  selectTrack(type: 'audio' | 'text', groupIndex: number, trackIndex: number): Promise<void>;
  addSubtitle(text: string, language: string, label: string): Promise<boolean>;
}

interface TvPlayerViewProps extends ViewProps {
  source: PlayerSource | null;
  paused: boolean;
  onStatus?(event: { nativeEvent: PlayerStatusEvent }): void;
  onError?(event: { nativeEvent: PlayerErrorEvent }): void;
}

interface VideoPreviewProps {
  channel: LiveChannel | null;
  _programme: EpgListing | null;
  categoryName: string;
  onPlay?: () => void;
  catchupOnPlay?: () => void;
  containerStyle?: ViewStyle;
  primed?: boolean;
  typedNumber?: string;
}

const RESOLUTION_TEXT = '1920 × 1080';

/**
 * Video preview component - shows live stream preview in a responsive container.
 * TV: uses native TvPlayerView (fixed 16:9). Web/desktop: wider on wide screens to show more EPG.
 */
export function VideoPreview({
  channel,
  _programme,
  categoryName,
  onPlay,
  catchupOnPlay,
  containerStyle,
  primed = true,
  typedNumber,
}: VideoPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const isTV = Platform.isTV;
  const { width } = useWindowDimensions();
  const host = useScreenHost();
  const { api, providerUserAgent } = host;
  const now = useNow();
  const showCatchupButton = _programme && channel?.hasCatchup && catchupMode(channel, _programme, now) === 'past';

  // Responsive aspect ratio: 16:9 on TV/narrow, wider on wide desktop to show more EPG below
  // At 720px (compact): 16/9 ≈ 1.78
  // At 1920px (TV): 16/9 ≈ 1.78 (TV keeps fixed 16:9 via isTV check)
  // At 2560px+: ~2.35 (21:9) - shorter preview, more EPG visible
  const aspectRatio = isTV ? 16 / 9 : Math.min(2.35, Math.max(16 / 9, 16 / 9 + (width - 720) * 0.0006));

  if (!channel) {
    const previewStyle = { ...styles.videoPreview, aspectRatio, ...containerStyle };
    return (
      <View style={previewStyle} testID="video-preview">
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

  // If not primed, show placeholder with instruction
  if (!primed) {
    const previewStyle = { ...styles.videoPreview, aspectRatio, ...containerStyle };
    return (
      <View style={previewStyle} testID="video-preview">
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderText}>{t('Press OK to load preview')}</Text>
        </View>
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

  // Platform-specific video player
  const VideoPlayer = isTV ? TvVideoPlayer : WebVideoPlayer;

  const videoPlayerStyle = showCatchupButton ? { pointerEvents: 'none' as const } : undefined;

  const previewStyle = { ...styles.videoPreview, aspectRatio, ...containerStyle };

  return (
    <View style={previewStyle} testID="video-preview">
      <VideoPlayer
        channel={channel}
        api={api}
        _providerUserAgent={providerUserAgent}
        onError={setError}
        style={videoPlayerStyle}
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
      {showCatchupButton && catchupOnPlay && (
        <View testID="preview-catchup-overlay" style={styles.catchupOverlay} accessibilityRole="none">
          <FocusButton
            label={t('Watch recording')}
            variant="primary"
            style={styles.previewPlayButton}
            testID="preview-catchup-button"
            onPress={catchupOnPlay}
            accessibilityLabel={t('Watch recording')}
          />
        </View>
      )}
      <View style={styles.videoOverlay} pointerEvents="none">
        <View style={styles.overlayLeft}>
          <Text style={styles.overlayChannelName}>{channel.name}</Text>
          <Text style={styles.overlayCategory}>{categoryName}</Text>
        </View>
        <View style={styles.overlayRight}>
          {typedNumber && <Text style={styles.overlayTypedNumber}>{t('Channel {num}', { num: typedNumber })}</Text>}
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
  const playerRef = useRef<TvPlayerViewRef | null>(null);
  const [source, setSource] = useState<{ uri: string; isHls: boolean; startPositionMs: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const alternates = useRef<string[]>([]);

  // Dynamic import for TvPlayerView - only available on TV (react-native-tvos).
  // Must be called unconditionally to satisfy React hooks rules.
  const [TvPlayerView, setTvPlayerView] = useState<React.ForwardRefExoticComponent<
    TvPlayerViewProps & React.RefAttributes<TvPlayerViewRef>
  > | null>(null);
  useEffect(() => {
    if (!isTV) return;
    let cancelled = false;
    // @ts-expect-error - module only exists in TV app context at runtime
    import('../../../../apps/tv-app/modules/tv-media')
      .then((mod) => {
        if (!cancelled) setTvPlayerView(() => mod.TvPlayerView);
      })
      .catch(() => {
        if (!cancelled) setTvPlayerView(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isTV]);

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

  if (!source || !TvPlayerView) {
    return (
      <View style={[styles.videoPlaceholder, style]}>
        <Text style={styles.placeholderText}>{t('Loading…')}</Text>
      </View>
    );
  }

  return (
    <TvPlayerView
      ref={playerRef}
      style={[StyleSheet.absoluteFill, style]}
      source={source}
      paused={false}
      onStatus={(e: { nativeEvent: PlayerStatusEvent }) => {
        const state = e.nativeEvent.state;
        if (state === 'error') {
          onError('Playback error');
        }
      }}
      onError={(e: { nativeEvent: PlayerErrorEvent }) => {
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
    <View style={[styles.videoPlayer, style]} pointerEvents="none">
      <video
        ref={videoRef}
        style={Platform.OS === 'web' ? { ...StyleSheet.absoluteFill, pointerEvents: 'none' } : StyleSheet.absoluteFill}
        muted
        playsInline
        autoPlay
      />
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
    backgroundColor: colors.bg,
    position: 'relative',
    width: '100%',
  },
  videoPlayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    zIndex: 1,
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  placeholderText: { color: colors.muted, fontSize: fonts.body },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.85)',
    padding: 16,
    zIndex: 10,
  },
  catchupOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.85)',
    padding: 16,
    zIndex: 10,
  },
  errorText: { color: colors.muted, fontSize: fonts.small, textAlign: 'center', marginBottom: 12 },
  previewPlayButton: { width: 180 },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(20,20,20,0.8)',
  },
  overlayLeft: { flexDirection: 'column', gap: 2 },
  overlayRight: { alignItems: 'flex-end' },
  overlayChannelName: {
    color: colors.strong,
    fontSize: fonts.body,
    fontWeight: '600',
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayCategory: {
    color: colors.muted,
    fontSize: fonts.tiny,
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayMeta: {
    color: colors.text,
    fontSize: fonts.tiny,
    fontWeight: '500',
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayTypedNumber: {
    color: colors.blue,
    fontSize: fonts.body,
    fontWeight: '700',
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 4,
  },
});
