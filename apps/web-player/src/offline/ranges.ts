export interface ByteRange {
  start: number;
  end: number;
}

/** Parses a single `bytes=` range. Returns null without header, 'invalid' when unsatisfiable. */
export function parseRange(header: string | null, total: number): ByteRange | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return 'invalid';
  let start: number;
  let end: number;
  if (!match[1]) {
    // Suffix range: last N bytes.
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  }
  return start > end || start >= total ? 'invalid' : { start, end };
}

/** Clamps a range to the chunk containing `start` so one response decrypts one chunk. */
export function clampToChunk(range: ByteRange, chunkSize: number): ByteRange & { chunk: number; offset: number } {
  const chunk = Math.floor(range.start / chunkSize);
  const chunkEnd = (chunk + 1) * chunkSize - 1;
  return { start: range.start, end: Math.min(range.end, chunkEnd), chunk, offset: range.start - chunk * chunkSize };
}
