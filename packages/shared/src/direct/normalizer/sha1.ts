/**
 * SHA-1 hex of a UTF-8 string. Only for stable master ids; not for security. Written for Hermes (no JIT), where ids for
 * 100k+ titles took about a third of building the titles on a TV (D-093, D-118):
 * - no allocation per call: the bytes go into one reused buffer, the rounds use one reused word array;
 * - the four round kinds are four loops, without a branch per round;
 * - the hex text comes from a table of the 256 byte values.
 */
const w = new Int32Array(80);
let buffer = new Uint8Array(256);

const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, '0'));
const hex = (value: number) => HEX[(value >>> 24) & 0xff]! + HEX[(value >>> 16) & 0xff]! + HEX[(value >>> 8) & 0xff]! + HEX[value & 0xff]!;

export function sha1Hex(text: string): string {
  const length = writeUtf8(text);
  // The message, a 0x80 byte, zeros, and the bit length in the last 8 bytes of the last 64-byte block.
  const end = Math.ceil((length + 9) / 64) * 64;
  if (end > buffer.length) {
    const bigger = new Uint8Array(end * 2);
    bigger.set(buffer.subarray(0, length));
    buffer = bigger;
  }
  const bytes = buffer;
  bytes[length] = 0x80;
  bytes.fill(0, length + 1, end);
  const bitLength = length * 8;
  const high = Math.floor(bitLength / 2 ** 32);
  const low = bitLength >>> 0;
  bytes[end - 8] = high >>> 24;
  bytes[end - 7] = (high >>> 16) & 0xff;
  bytes[end - 6] = (high >>> 8) & 0xff;
  bytes[end - 5] = high & 0xff;
  bytes[end - 4] = low >>> 24;
  bytes[end - 3] = (low >>> 16) & 0xff;
  bytes[end - 2] = (low >>> 8) & 0xff;
  bytes[end - 1] = low & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89 | 0;
  let h2 = 0x98badcfe | 0;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0 | 0;
  for (let offset = 0; offset < end; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const at = offset + i * 4;
      w[i] = (bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!;
    }
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let t: number;
    for (let i = 0; i < 20; i++) {
      t = (((a << 5) | (a >>> 27)) + ((b & c) | (~b & d)) + e + 0x5a827999 + w[i]!) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    for (let i = 20; i < 40; i++) {
      t = (((a << 5) | (a >>> 27)) + (b ^ c ^ d) + e + 0x6ed9eba1 + w[i]!) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    for (let i = 40; i < 60; i++) {
      t = (((a << 5) | (a >>> 27)) + ((b & c) | (b & d) | (c & d)) + e + 0x8f1bbcdc + w[i]!) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    for (let i = 60; i < 80; i++) {
      t = (((a << 5) | (a >>> 27)) + (b ^ c ^ d) + e + 0xca62c1d6 + w[i]!) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

/** Writes `text` as UTF-8 into `buffer` (grown when needed); returns the byte count. */
function writeUtf8(text: string): number {
  // At most 3 bytes per UTF-16 unit, plus room for the padding.
  const most = text.length * 3 + 72;
  if (most > buffer.length) buffer = new Uint8Array(most * 2);
  const bytes = buffer;
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes[length++] = code;
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x800) {
      bytes[length++] = 0xc0 | (code >> 6);
      bytes[length++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      bytes[length++] = 0xe0 | (code >> 12);
      bytes[length++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[length++] = 0x80 | (code & 0x3f);
    } else {
      bytes[length++] = 0xf0 | (code >> 18);
      bytes[length++] = 0x80 | ((code >> 12) & 0x3f);
      bytes[length++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[length++] = 0x80 | (code & 0x3f);
    }
  }
  return length;
}

const isPlainAscii = (text: string) => {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
};

/**
 * `hashIds` for `buildMastersInChunks` from a native hasher (D-118): plain-ASCII texts (nearly every id) go to
 * `hashAscii` in batches, separated by "\n", which answers their 40-character hex digests one after another; any other
 * text (a key in another script) is hashed here, since native code gets the text as modified UTF-8. If the native call
 * fails, that batch is hashed here too: the ids are the same either way.
 */
export function batchedSha1(hashAscii: (joined: string) => Promise<string>, batchSize = 10_000) {
  return async (texts: string[]): Promise<string[]> => {
    const result = new Array<string>(texts.length);
    const ascii: number[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (isPlainAscii(texts[i]!)) ascii.push(i);
      else result[i] = sha1Hex(texts[i]!);
    }
    for (let start = 0; start < ascii.length; start += batchSize) {
      const batch = ascii.slice(start, start + batchSize);
      let joined = '';
      try {
        joined = await hashAscii(batch.map((index) => texts[index]).join('\n'));
      } catch {
        // Hashed below.
      }
      if (joined.length === batch.length * 40) batch.forEach((index, k) => (result[index] = joined.slice(k * 40, k * 40 + 40)));
      else for (const index of batch) result[index] = sha1Hex(texts[index]!);
    }
    return result;
  };
}
