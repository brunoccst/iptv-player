/** AES-GCM encryption of stored chunks. Layout: 12-byte IV followed by ciphertext + tag. See DECISIONS.md#d-024. */
const IV_LENGTH = 12;

/** Non-extractable key: usable by page and Service Worker, raw bytes cannot be exported by script. */
export function generateChunkKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptChunk(key: CryptoKey, data: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const payload = new Uint8Array(IV_LENGTH + ciphertext.length);
  payload.set(iv);
  payload.set(ciphertext, IV_LENGTH);
  return payload.buffer;
}

export function decryptChunk(key: CryptoKey, payload: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(payload);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, IV_LENGTH) }, key, bytes.subarray(IV_LENGTH));
}
