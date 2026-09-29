/**
 * Reads a JSON array one element at a time from a byte stream (D-113, issue #109). A provider's movie list can be
 * 100+ MB of JSON; reading it as one text needed a single string that size, which ran a TV with a 192 MB Java heap out
 * of memory (in the native fetch, before any JavaScript ran). Here only one chunk and one element are held at a time,
 * and `pick` keeps what the app needs from each element.
 */

const OPEN_OBJECT = 123; // {
const CLOSE_OBJECT = 125; // }
const OPEN_ARRAY = 91; // [
const CLOSE_ARRAY = 93; // ]
const QUOTE = 34; // "
const BACKSLASH = 92; // \
const COMMA = 44; // ,

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
): Promise<ArrayReadResult<T>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  const items: T[] = [];
  let chars = 0;
  // What is not parsed yet: the rest of the current element (and whatever follows it in the chunk).
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
      if (phase === 0) {
        if (isSpace(code)) pos++;
        else if (code === OPEN_ARRAY) {
          phase = 1;
          pos++;
        } else {
          phase = 3;
          return;
        }
        continue;
      }
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

  for (;;) {
    const { done, value } = await reader.read();
    const text = done ? decoder.decode() : decoder.decode(value, { stream: true });
    chars += text.length;
    buffer += text;
    if (phase !== 3) {
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
