import Constants from 'expo-constants';
import { useTVEventHandler } from 'react-native';

export type RemoteAction = 'down' | 'up' | 'unknown';

export interface RemoteEvent {
  /** `left`, `right`, `up`, `down`, `select`, `playPause`, `rewind`, `fastForward`, … */
  key: string;
  /** Android reports key-down (auto-repeated while held) and key-up. Some remotes/platforms omit it. */
  action: RemoteAction;
}

const DEBUG = Constants.expoConfig?.extra?.APP_TV_DEBUG_REMOTE === '1';

/** Subscribes to remote/D-pad events while mounted. Thin wrapper so tests can drive it. See DECISIONS.md#d-028. */
export function useRemote(handler: (event: RemoteEvent) => void) {
  useTVEventHandler((event) => {
    if (DEBUG) console.log(`[remote] ${event.eventType} action=${String(event.eventKeyAction)}`);
    const action = event.eventKeyAction === 0 ? 'down' : event.eventKeyAction === 1 ? 'up' : 'unknown';
    handler({ key: event.eventType, action });
  });
}
