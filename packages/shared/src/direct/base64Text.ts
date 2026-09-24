const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(value: string): Uint8Array | null {
  const clean = value.replace(/=+$/, '');
  if (clean.length === 0 || clean.length % 4 === 1 || !/^[A-Za-z0-9+/]*$/.test(clean) || value.length % 4 !== 0) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** Strict UTF-8: null on any invalid sequence. Hermes has no fatal TextDecoder, so this is manual. */
function decodeUtf8(bytes: Uint8Array): string | null {
  let text = '';
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]!;
    const length =
      first < 0x80 ? 1 : first >= 0xc2 && first < 0xe0 ? 2 : first >= 0xe0 && first < 0xf0 ? 3 : first >= 0xf0 && first < 0xf5 ? 4 : 0;
    if (length === 0 || index + length > bytes.length) return null;
    let code = length === 1 ? first : first & (0xff >> (length + 1));
    for (let offset = 1; offset < length; offset++) {
      const next = bytes[index + offset]!;
      if ((next & 0xc0) !== 0x80) return null;
      code = (code << 6) | (next & 0x3f);
    }
    if ((length === 3 && code < 0x800) || (length === 4 && (code < 0x10000 || code > 0x10ffff)) || (code >= 0xd800 && code <= 0xdfff))
      return null;
    text += String.fromCodePoint(code);
    index += length;
  }
  return text;
}

/** Short-EPG titles are base64 on most panels and plain text on some. Mirrors the backend's DecodeBase64. */
export function decodeMaybeBase64(value: string | null): string | null {
  if (value === null) return null;
  const bytes = decodeBase64(value);
  if (!bytes || bytes.length === 0) return value;
  const text = decodeUtf8(bytes)?.trim();
  // Plain words like "News" are also valid base64; control characters mean the value was plain text.
  return !text || /\p{Cc}/u.test(text) ? value : text;
}
