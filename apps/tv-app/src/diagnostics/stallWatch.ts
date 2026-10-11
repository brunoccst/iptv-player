import { AppState } from 'react-native';
import { appLog } from '@iptv/shared';

/** A check every second; a gap this long means the JavaScript thread was busy (the app looks frozen meanwhile). */
const TICK_MS = 1000;
const STALL_MS = 2000;

/**
 * Logs when the JavaScript thread was blocked, and for how long, so the Log screen shows what froze on a slow TV
 * (D-093). Returns a stop function. Android stops the app's timers while it is in the background (another input, the
 * screen saver, the home screen), so a gap that spans a trip to the background is not a busy thread (D-172).
 */
export function startStallWatch(now: () => number = Date.now): () => void {
  let last = now();
  const timer = setInterval(() => {
    const time = now();
    const gap = time - last - TICK_MS;
    if (gap >= STALL_MS && AppState.currentState !== 'background')
      appLog.warn('app', `JavaScript was busy for ${(gap / 1000).toFixed(1)} s (the app did not react meanwhile)`);
    last = time;
  }, TICK_MS);
  const subscription = AppState.addEventListener('change', () => (last = now()));
  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}
