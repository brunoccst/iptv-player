import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { asciiJson, fromAscii, fromBase64, randomBytes, toBase64 } from '../utils/bytes';

/**
 * JSON sealed with a shared 32-byte key (base64): XChaCha20-Poly1305 with a random nonce. Used between phone and TV
 * (D-060, D-061); internal, not exported from the package.
 */
export function seal(key: string, value: unknown): string {
  const nonce = randomBytes(24);
  const bytes = Uint8Array.from(asciiJson(value), (c) => c.charCodeAt(0));
  return JSON.stringify({ nonce: toBase64(nonce), data: toBase64(xchacha20poly1305(fromBase64(key), nonce).encrypt(bytes)) });
}

/** `null` when the text was not sealed with this key (wrong or old code, or changed on the way). */
export function unseal<T>(key: string, text: string): T | null {
  try {
    const { nonce, data } = JSON.parse(text) as { nonce: string; data: string };
    return JSON.parse(fromAscii(xchacha20poly1305(fromBase64(key), fromBase64(nonce)).decrypt(fromBase64(data)))) as T;
  } catch {
    return null;
  }
}
