/**
 * Reads a JSON array one element at a time from a byte stream (D-113, issue #109). A provider's movie list can be
 * 100+ MB of JSON; reading it as one text needed a single string that size, which ran a TV with a 192 MB Java heap out
 * of memory (in the native fetch, before any JavaScript ran). Here only one chunk and one element are held at a time,
 * and `pick` keeps what the app needs from each element.
 *
 * Speed: going through every character in JavaScript was about 3× slower than parsing the whole text at once, which
 * on a Chromecast added more than a minute to a 100 MB list. So the text is cut into batches of about 500k characters
 * at an element boundary ("},{"), and each batch is parsed by the engine's own JSON.parse. A cut inside a string or a
 * nested object makes that parse fail (the brackets or quotes no longer match), and then the rest of the list goes
 * through the character-by-character reader instead, so the result is the same either way.
 */

const OPEN_OBJECT = 123; // {
const CLOSE_OBJECT = 125; // }
const OPEN_ARRAY = 91; // [
const CLOSE_ARRAY = 93; // ]
const QUOTE = 34; // "
const BACKSLASH = 92; // \
const COMMA = 44; // ,

/** Characters gathered before a batch is parsed (a few hundred ms of work on a TV at most). */
const BATCH_CHARS = 500_000;
/** Earlier "},{" tried when a cut lands inside an element (a nested object, or the text of a name). */
const CUT_TRIES = 3;
/** With no "},{" in this many batches' worth of text (plain values, or spaces between elements), give up on batches. */
const MAX_BATCH_FACTOR = 8;

const isSpace = (code: number) => code === 32 || code === 10 || code === 13 || code === 9 || code === 0xfeff;

/** Why the stream could not be read as an array: the text so far, for the caller's error message. */
export class NotAJsonArray extends Error {
  constructor(readonly preview: string) {
    super('not a JSON array');
  }
}

export interface ArrayReadResult<T> {
  items: T[];
  /** Characters read, for the log. */
  chars: number;
}

/**
 * The elements of the top-level JSON array in `stream`, each passed through `pick` (null = dropped). A reply that is
 * not an array (an object, an error page) is read whole and handed to `other` instead, as the parsed value, or as text
 * when it is not JSON either (then `NotAJsonArray` is thrown).
 */
export async function readJsonArray<T>(
  stream: ReadableStream<Uint8Array>,
  pick: (element: unknown) => T | null,
  other: (value: unknown) => T[],
  { batchChars = BATCH_CHARS }: { batchChars?: number } = {},
): Promise<ArrayReadResult<T>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  const items: T[] = [];
  let chars = 0;
  // What is not parsed yet: the next batch, or the rest of the current element (and whatever follows it).
  let buffer = '';
  let pos = 0;
  // Before the array's "[" (0), inside it (1), after its "]" (2); a reply that is not an array (3).
  let phase = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  const take = (end: number) => {
    const value = JSON.parse(buffer.slice(start, end)) as unknown;
    const kept = pick(value);
    if (kept !== null) items.push(kept);
    start = -1;
  };

  const scan = () => {
    while (pos < buffer.length && phase < 2) {
      const code = buffer.charCodeAt(pos);
      if (inString) {
        if (escaped) escaped = false;
        else if (code === BACKSLASH) escaped = true;
        else if (code === QUOTE) {
          inString = false;
          // A string element ("a", "b") ends with its quote.
          if (depth === 0 && start >= 0) take(pos + 1);
        }
        pos++;
        continue;
      }
      if (start < 0) {
        // Between elements: spaces and commas; "]" ends the array.
        if (isSpace(code) || code === COMMA) pos++;
        else if (code === CLOSE_ARRAY) {
          phase = 2;
          pos++;
        } else start = pos;
        continue;
      }
      if (code === QUOTE) inString = true;
      else if (code === OPEN_OBJECT || code === OPEN_ARRAY) depth++;
      else if (code === CLOSE_OBJECT || code === CLOSE_ARRAY) {
        if (depth === 0) {
          // "]" right after a number, true, false or null: the element ends here, and so does the array.
          take(pos);
          phase = 2;
        } else if (--depth === 0) take(pos + 1);
      } else if (depth === 0 && (code === COMMA || isSpace(code))) take(pos);
      pos++;
    }
  };

  // Whole batches of elements go to JSON.parse while that works; after the first failure, `scan` reads the rest.
  let batches = true;
  const parseBatch = (text: string): boolean => {
    let values: unknown;
    try {
      values = JSON.parse(text);
    } catch {
      return false;
    }
    if (!Array.isArray(values)) return false;
    for (const value of values) {
      const kept = pick(value);
      if (kept !== null) items.push(kept);
    }
    return true;
  };
  const readBatches = (done: boolean) => {
    // Right after the "[": the buffer starts at an element (or the "]" of an empty array).
    if (done) {
      if (parseBatch('[' + buffer)) {
        buffer = '';
        phase = 2;
      } else batches = false;
      return;
    }
    if (buffer.length < batchChars) return;
    let cut = buffer.length;
    for (let tries = 0; tries < CUT_TRIES; tries++) {
      cut = buffer.lastIndexOf('},{', cut - 1);
      if (cut < 0) break;
      if (parseBatch('[' + buffer.slice(0, cut + 1) + ']')) {
        buffer = buffer.slice(cut + 2);
        return;
      }
    }
    if (cut >= 0 || buffer.length > MAX_BATCH_FACTOR * batchChars) batches = false;
  };

  for (;;) {
    const { done, value } = await reader.read();
    const text = done ? decoder.decode() : decoder.decode(value, { stream: true });
    chars += text.length;
    buffer += text;
    if (phase === 0) {
      while (pos < buffer.length && isSpace(buffer.charCodeAt(pos))) pos++;
      if (pos < buffer.length) {
        if (buffer.charCodeAt(pos) === OPEN_ARRAY) {
          phase = 1;
          buffer = buffer.slice(pos + 1);
        } else phase = 3;
        pos = 0;
      }
    }
    if (phase === 1 && batches) readBatches(done);
    if (phase === 1 && !batches) {
      scan();
      // Keep only what the next chunk needs: the unfinished element.
      const keep = start >= 0 ? start : pos;
      buffer = buffer.slice(keep);
      pos -= keep;
      if (start >= 0) start = 0;
    }
    if (done) break;
    if (phase === 2) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }

  if (phase === 3) {
    const text = buffer.trim();
    try {
      return { items: other(JSON.parse(text) as unknown), chars };
    } catch {
      throw new NotAJsonArray(text);
    }
  }
  if (phase === 0) {
    if (buffer.trim() === '') return { items, chars };
    throw new NotAJsonArray(buffer.trim());
  }
  if (phase === 1) throw new NotAJsonArray(buffer.trim().slice(0, 200));
  return { items, chars };
}
