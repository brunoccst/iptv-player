import { useEffect, useRef } from 'react';
import type { RemoteEvent } from '../src/tv/remote';

export type { RemoteAction, RemoteEvent } from '../src/tv/remote';

const handlers = new Set<(event: RemoteEvent) => void>();

/** Test double for src/tv/remote.ts: `pressRemote` delivers events to mounted `useRemote` handlers. */
export function useRemote(handler: (event: RemoteEvent) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const listener = (event: RemoteEvent) => latest.current(event);
    handlers.add(listener);
    return () => void handlers.delete(listener);
  }, []);
}

export function pressRemote(key: string, action: RemoteEvent['action'] = 'unknown') {
  handlers.forEach((handler) => handler({ key, action }));
}
