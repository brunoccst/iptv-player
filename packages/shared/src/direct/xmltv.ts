/**
 * The provider's full TV guide (`xmltv.php`, XMLTV) read as a stream (issue #119, D-130): it can be hundreds of MB for
 * 20,000+ channels and a week, so it is never held whole. Only programmes inside a time window are kept.
 */

/** A programme of the full guide: `channel` is the guide's channel id (a live channel's `epgChannelId`). */
export interface GuideProgramme {
  channel: string;
  /** Epoch ms. */
  start: number;
  stop: number;
  title: string;
}

/** "20261003201500 +0200" (offset optional, UTC without it) → epoch ms; null when unreadable. */
export function parseXmltvTime(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*(?:([+-])(\d{2}):?(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s, sign, oh, om] = match;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  if (Number.isNaN(utc)) return null;
  const offset = sign ? (sign === '-' ? -1 : 1) * (Number(oh) * 60 + Number(om)) * 60_000 : 0;
  return utc - offset;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .trim();

const attribute = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag);
const attributeValue = (tag: string, name: string) => {
  const match = attribute(tag, name);
  return match ? decode(match[2] ?? match[3] ?? '') : null;
};

/** One `<programme …>…</programme>` element, or null when it lacks a channel, a time or a title. */
export function parseProgramme(element: string): GuideProgramme | null {
  const open = element.slice(0, element.indexOf('>') + 1);
  const channel = attributeValue(open, 'channel');
  const start = parseXmltvTime(attributeValue(open, 'start') ?? '');
  const stop = parseXmltvTime(attributeValue(open, 'stop') ?? '');
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/.exec(element)?.[1];
  if (!channel || start === null || stop === null || stop <= start || !title) return null;
  const text = decode(title);
  return text ? { channel, start, stop, title: text } : null;
}

/**
 * Reads XMLTV text in pieces of any size: each complete programme that overlaps [`from`, `to`) is handed to
 * `onProgramme`. Text after the last complete programme waits for the next piece.
 */
export function createXmltvReader(window: { from: number; to: number }, onProgramme: (programme: GuideProgramme) => void) {
  let rest = '';
  let seen = 0;
  return {
    /** Programmes found so far, in the window or not. */
    get seen() {
      return seen;
    },
    feed(text: string) {
      const buffer = rest + text;
      let at = 0;
      for (;;) {
        const begin = buffer.indexOf('<programme', at);
        if (begin < 0) {
          // Keep a possible "<programm" cut at the end.
          at = Math.max(at, buffer.length - '<programme'.length);
          break;
        }
        const end = buffer.indexOf('</programme>', begin);
        if (end < 0) {
          at = begin;
          break;
        }
        at = end + '</programme>'.length;
        seen++;
        const programme = parseProgramme(buffer.slice(begin, at));
        if (programme && programme.stop > window.from && programme.start < window.to) onProgramme(programme);
      }
      rest = buffer.slice(at);
    },
  };
}
