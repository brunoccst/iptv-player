import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { downloadIdFor, type DownloadMenuState, type PlayTarget } from '@iptv/shared';
import { downloadsStore } from '../appContext';
import { downloadTargetFrom, selectDownload } from '../downloads/downloadsStore';
import { useDownloads } from '../hooks';
import { colors } from '../theme';
import { AnimatedPressable, focus, useFocusScale } from './focus';
import { Icon } from './Icon';
import { ProgressRing } from './ProgressRing';

/** A title's download: where it is, and what selecting it does (start / pause / resume / retry). Null when it cannot be downloaded. */
export function useDownload(target: PlayTarget) {
  const record = useDownloads((s) => (target.kind === 'live' ? null : selectDownload(s, target.kind, target.streamId)));
  const error = useDownloads((s) =>
    record ? null : (s.errors[downloadIdFor(target.kind as 'movie' | 'episode', target.streamId)] ?? null),
  );
  const downloadTarget = downloadTargetFrom(target);
  if (!downloadTarget) return null;

  const state = record?.state;
  const failed = state === 'failed' || !!error;
  const active = state === 'downloading' || state === 'queued' || state === 'paused';
  const percent = Math.round((record?.progress ?? 0) * 100);
  const label =
    state === 'completed'
      ? 'Downloaded'
      : state === 'downloading' || state === 'queued'
        ? `Downloading ${percent}%`
        : state === 'paused'
          ? `Paused ${percent}%`
          : failed
            ? 'Download failed · Retry'
            : 'Download';
  /** For the episode menu (D-083). */
  const menu: DownloadMenuState = {
    status:
      state === 'completed'
        ? 'completed'
        : state === 'downloading' || state === 'queued'
          ? 'downloading'
          : state === 'paused'
            ? 'paused'
            : failed
              ? 'failed'
              : 'none',
    percent,
  };

  const toggle = () => {
    const { start, pause, resume } = downloadsStore.getState();
    if (!record || state === 'failed') void start(downloadTarget);
    else if (state === 'downloading' || state === 'queued') pause(record.id);
    else if (state === 'paused') resume(record.id);
  };
  return { state, failed, active, progress: record?.progress ?? 0, label, menu, toggle };
}

/** Web `.download-button`: round button with a progress ring. Select toggles start / pause / resume. */
export function DownloadButton({ target }: { target: PlayTarget }) {
  const [focused, setFocused] = useState(false);
  const scale = useFocusScale(focused, 1.12);
  const download = useDownload(target);
  if (!download) return null;
  const { state, failed, active, label, toggle: onPress } = download;

  return (
    <AnimatedPressable
      testID="download-button"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${target.title}`}
      accessibilityState={{ disabled: state === 'completed' }}
      disabled={state === 'completed'}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.button, focused && styles.focused, { transform: [{ scale }] }]}
    >
      {active ? (
        <View style={StyleSheet.absoluteFill}>
          <ProgressRing value={download.progress} size={36} />
        </View>
      ) : null}
      <Icon
        name={state === 'completed' ? 'check' : failed ? 'alert' : state === 'downloading' || state === 'queued' ? 'pause' : 'download'}
        size={active ? 16 : 20}
        color={state === 'completed' ? colors.success : failed ? colors.warning : colors.strong}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.8)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focused: { borderColor: focus.ring, ...focus.glow },
});
