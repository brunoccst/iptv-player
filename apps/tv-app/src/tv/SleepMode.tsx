import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { createStore } from 'zustand/vanilla';
import { useAppStore } from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { appConfig } from '../config';
import { colors, fonts } from '../theme';
// Same path as elsewhere (`../tv/remote`), so tests swap in the remote double (jest.config.js).
import { useRemote } from '../tv/remote';

/** No remote input for this long (and no video playing): the app's own sleep screen. */
export const SLEEP_AFTER_MS = 10 * 60_000;
/** Asleep this long: the app lets the screen turn off (the TV's own power and screensaver settings apply again). */
export const RELEASE_SCREEN_AFTER_MS = 3 * 60 * 60_000;
const TICK_MS = 30_000;
/** The clock moves every minute, so nothing stays on one spot of the screen. */
const MOVE_MS = 60_000;

/** The player reports whether a video is playing: no sleep then (watching needs no key presses). */
export const sleepControl = createStore<{ playing: boolean }>()(() => ({ playing: false }));

const keepScreenOn = (on: boolean) => {
  try {
    void TvMedia.setKeepScreenOn(on)?.catch(() => undefined);
  } catch {
    // No activity (app closing): nothing to keep on.
  }
};

/**
 * TV sleep mode (D-068). While the app is open the screen stays on, so the TV's screensaver does not start: that sent
 * the app to the background, Android closed it, and the next key press restarted it from scratch. Instead, after
 * `SLEEP_AFTER_MS` without a key press the app shows its own dark screen with a slowly moving clock; any button brings
 * everything back as it was. After `RELEASE_SCREEN_AFTER_MS` asleep the screen may turn off again.
 */
export function SleepMode({ now = () => Date.now() }: { now?: () => number }) {
  const [asleepSince, setAsleepSince] = useState<number | null>(null);
  const lastInput = useRef(now());
  const playing = useAppStore(sleepControl, (s) => s.playing);

  const wake = () => {
    lastInput.current = now();
    setAsleepSince(null);
    keepScreenOn(true);
  };

  // Any key counts as activity; a key while asleep only wakes the app.
  useRemote(() => {
    if (asleepSince !== null) wake();
    else lastInput.current = now();
  });

  useEffect(() => {
    keepScreenOn(true);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') wake();
    });
    return () => {
      subscription.remove();
      keepScreenOn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (playing) {
        lastInput.current = now();
        return;
      }
      const time = now();
      if (asleepSince === null && time - lastInput.current >= SLEEP_AFTER_MS) setAsleepSince(time);
      if (asleepSince !== null && time - asleepSince >= RELEASE_SCREEN_AFTER_MS) keepScreenOn(false);
    }, TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, asleepSince]);

  if (asleepSince === null) return null;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={wake}>
      <Pressable style={styles.screen} onPress={wake} hasTVPreferredFocus accessibilityLabel="Wake up" testID="sleep-screen">
        <DriftingClock now={now} />
      </Pressable>
    </Modal>
  );
}

function DriftingClock({ now }: { now(): number }) {
  const { width, height } = useWindowDimensions();
  const [time, setTime] = useState(now());
  useEffect(() => {
    const timer = setInterval(() => setTime(now()), MOVE_MS);
    return () => clearInterval(timer);
  }, [now]);
  // A new spot each minute, within the middle of the screen.
  const step = Math.floor(time / MOVE_MS);
  const left = ((step * 37) % 60) / 100;
  const top = ((step * 53) % 60) / 100;
  const clock = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.clock, { left: width * (0.1 + left * 0.8 * 0.8), top: height * (0.1 + top * 0.8 * 0.8) }]}>
      <Text style={styles.time}>{clock}</Text>
      <Text style={styles.name}>{appConfig.appName}</Text>
      <Text style={styles.hint}>Press any button to continue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  clock: { position: 'absolute', alignItems: 'center', gap: 6 },
  time: { color: 'rgba(255,255,255,0.75)', fontSize: 64, fontWeight: '300' },
  name: { color: colors.accent, fontSize: fonts.heading, fontWeight: '900', opacity: 0.7 },
  hint: { color: 'rgba(255,255,255,0.45)', fontSize: fonts.small },
});
