import { useEffect, useRef } from 'react';
import { createRemoteNormalizer, type RemoteEvent } from '../src/tv/remoteEvents';

export type { RemoteAction, RemoteEvent } from '../src/tv/remoteEvents';

const handlers = new Set<(event: RemoteEvent) => void>();

/** Test double for src/tv/remote.ts: `pressRemote` delivers events to mounted `useRemote` handlers, normalized like the real hook. */
export function useRemote(handler: (event: RemoteEvent) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const listener = createRemoteNormalizer((event) => latest.current(event));
    handlers.add(listener);
    return () => void handlers.delete(listener);
  }, []);
}

export function pressRemote(key: string, action: RemoteEvent['action'] = 'unknown') {
  handlers.forEach((handler) => handler({ key, action }));
}
