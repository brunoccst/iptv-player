import Constants from 'expo-constants';
import { useRef } from 'react';
import { useTVEventHandler } from 'react-native';
import { createRemoteNormalizer, type RemoteEvent } from './remoteEvents';

export type { RemoteAction, RemoteEvent } from './remoteEvents';

const DEBUG = Constants.expoConfig?.extra?.APP_TV_DEBUG_REMOTE === '1';

/** Subscribes to remote/D-pad events while mounted, as down/up pairs. Thin wrapper so tests can drive it. See DECISIONS.md#d-028. */
export function useRemote(handler: (event: RemoteEvent) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  const normalize = useRef(createRemoteNormalizer((event) => latest.current(event))).current;
  useTVEventHandler((event) => {
    if (DEBUG) console.log(`[remote] ${event.eventType} action=${String(event.eventKeyAction)}`);
    const action = event.eventKeyAction === 0 ? 'down' : event.eventKeyAction === 1 ? 'up' : 'unknown';
    normalize({ key: event.eventType, action });
  });
}
