/**
 * The React Native Web trial (issue #237, DECISIONS.md#d-193): My List from `@iptv/screens` instead of this app's own
 * page, while `?screens=shared` was opened once (`?screens=web` goes back). Kept in this browser's storage.
 */
const KEY = 'iptv.sharedScreens';

export function sharedScreensOn(
  search: string = globalThis.location?.search ?? '',
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
): boolean {
  const asked = new URLSearchParams(search).get('screens');
  try {
    if (asked === 'shared' || asked === 'web') storage?.setItem(KEY, asked);
    return (asked ?? storage?.getItem(KEY)) === 'shared';
  } catch {
    return asked === 'shared';
  }
}

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
