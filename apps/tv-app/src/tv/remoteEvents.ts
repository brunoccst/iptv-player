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
 * Also normalizes Android TV numeric key codes (KEYCODE_NUM_0..9, KEYCODE_0..9) to '0'..'9'.
 */
export function createRemoteNormalizer(emit: (event: RemoteEvent) => void) {
  const held = new Set<string>();
  return (event: RemoteEvent) => {
    // Normalize Android TV numeric key codes to simple digits
    let key = event.key;
    const numMatch = key.match(/^(?:KEYCODE_)?(?:NUM_)?([0-9])$/);
    if (numMatch?.[1]) key = numMatch[1];

    if (event.action === 'down') held.add(key);
    if (event.action === 'up') {
      if (!held.delete(key)) emit({ key, action: 'down' });
    }
    emit({ ...event, key });
  };
}
