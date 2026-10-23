import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PlayTarget } from '@iptv/shared';
import { useScreenHost } from '../host';
import { colors } from './theme';
import { AnimatedPressable, focus, useFocusScale } from './focus';
import { Icon } from './Icon';
import { ProgressRing } from './ProgressRing';

/**
 * Web `.download-button`: round button with a progress ring; selecting it starts, pauses, resumes or retries the
 * download. Nothing where this app cannot download the title (live channels, a plain browser).
 */
export function DownloadButton({ target, durationSeconds }: { target: PlayTarget; durationSeconds?: number | null }) {
  const [focused, setFocused] = useState(false);
  const scale = useFocusScale(focused, 1.12);
  const download = useScreenHost().details.useDownload(target, durationSeconds);
  if (!download) return null;
  const { status, label, toggle } = download;
  const active = status === 'downloading' || status === 'queued' || status === 'paused';
  const failed = status === 'failed';

  return (
    <AnimatedPressable
      testID="download-button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: status === 'completed' }}
      disabled={status === 'completed'}
      onPress={toggle}
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
        name={status === 'completed' ? 'check' : failed ? 'alert' : status === 'downloading' || status === 'queued' ? 'pause' : 'download'}
        size={active ? 16 : 20}
        color={status === 'completed' ? colors.success : failed ? colors.warning : colors.strong}
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
