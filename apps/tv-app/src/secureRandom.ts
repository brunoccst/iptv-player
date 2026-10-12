import { TvMedia } from '../modules/tv-media';

/**
 * Hermes has no Web Crypto, so the shared backup and pairing code would fall back to `Math.random` for salts and
 * nonces (issue #233). Fills `crypto.getRandomValues` from Android's SecureRandom instead, before anything else runs.
 */
export function installSecureRandom() {
  const crypto = ((globalThis as { crypto?: Partial<Crypto> }).crypto ??= {});
  if (crypto.getRandomValues) return;
  crypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
    if (!array) return array;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let at = 0; at < bytes.length;) {
      const key = atob(TvMedia.randomKey());
      for (let i = 0; i < key.length && at < bytes.length; i++) bytes[at++] = key.charCodeAt(i);
    }
    return array;
  }) as Crypto['getRandomValues'];
}
