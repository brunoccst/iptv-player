export type RemoteAction = 'down' | 'up' | 'unknown';

export interface RemoteEvent {
  /** `left`, `right`, `up`, `down`, `select`, `playPause`, `rewind`, `fastForward`, … */
  key: string;
  /** Android reports key-down (auto-repeated while held) and key-up. Some remotes/platforms omit it. */
  action: RemoteAction;
}

/**
 * Makes every key arrive as a down/up pair. react-native-tvos can report a key only on release (`select` always;
 * arrows when no view takes focus), so a release without a press becomes press + release (a tap). See DECISIONS.md#d-028.
 */
export function createRemoteNormalizer(emit: (event: RemoteEvent) => void) {
  const held = new Set<string>();
  return (event: RemoteEvent) => {
    if (event.action === 'down') held.add(event.key);
    if (event.action === 'up') {
      if (!held.delete(event.key)) emit({ key: event.key, action: 'down' });
    }
    emit(event);
  };
}
