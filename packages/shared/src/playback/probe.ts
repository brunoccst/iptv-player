import { t } from '../i18n/i18n'; /**
 * What the provider actually sends for a stream the player could not read (D-074). The player only says "not a video";
 * the first bytes of the answer usually say why: an error page ("max connections reached", "file not found"), a
 * redirect to a blocked page, or an empty answer. Used for the diagnostics log and a clearer error message.
 */
export interface StreamProbe {
  /** HTTP status of the final answer (after redirects); 0 when the request itself failed. */
  status: number;
  contentType: string | null;
  /** Content-Length header, when sent. */
  length: number | null;
  /** Host of the final address (redirects to another server are common). */
  host: string | null;
  /** Start of the answer as one line of text, credentials masked; null for binary data or when not read. */
  text: string | null;
  /** Hex of the first bytes of binary answers (a video would start with a known signature). */
  hex: string | null;
  /** Why nothing came back, when the request failed. */
  error: string | null;
  /** Codecs named in the first bytes of a video (MKV track ids, MP4 sample entries), e.g. `hevc`, `ac3`. */
  codecs: string[];
}

/** What the answer means for the user, when it is recognisable. */
export type ProbeHint = 'connections' | 'not-found' | 'refused' | 'expired' | 'empty' | null;

/** Enough for an MKV's track list or an MP4's sample entries (when its index is at the start). */
const PROBE_BYTES = 64 * 1024;
/** Error pages are judged by their start. */
const TEXT_BYTES = 2048;
/** Longer answers are not read (a server that ignores Range would send the whole file). */
const MAX_READ = 64 * 1024;
const TEXT_CHARS = 240;

/**
 * Asks for the first bytes of `url` like the player does (same User-Agent). Never throws. Credentials from the stream
 * address (`/series/<user>/<pass>/…`) are masked in the text, in case the provider echoes them.
 */
export async function probeStream(
  url: string,
  { userAgent, fetch: fetchImpl = fetch, timeoutMs = 8000 }: { userAgent?: string; fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<StreamProbe> {
  const result: StreamProbe = { status: 0, contentType: null, length: null, host: null, text: null, hex: null, error: null, codecs: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}`, ...(userAgent ? { 'User-Agent': userAgent } : {}) },
      signal: controller.signal,
    });
    result.status = response.status;
    result.contentType = response.headers.get('content-type');
    const length = Number(response.headers.get('content-length'));
    result.length = Number.isFinite(length) && response.headers.get('content-length') !== null ? length : null;
    result.host = hostOf(response.url || url);
    if (result.length === null || result.length <= MAX_READ) {
      const bytes = new Uint8Array(await response.arrayBuffer()).slice(0, PROBE_BYTES);
      if (result.length === null) result.length = bytes.length;
      const start = bytes.slice(0, TEXT_BYTES);
      if (looksLikeText(start)) result.text = oneLine(decode(start), credentialsOf(url));
      else {
        result.hex = [...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
        result.codecs = codecsIn(bytes);
      }
    }
  } catch (error) {
    result.error = controller.signal.aborted ? 'no answer within 8 s' : error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timer);
  }
  return result;
}

/** One log line: `HTTP 200, text/html, 512 bytes from host: "…"`. */
export function describeProbe(probe: StreamProbe): string {
  if (probe.error) return `no answer (${probe.error})`;
  const parts = [
    `HTTP ${probe.status}`,
    probe.contentType ?? 'no content type',
    probe.length === null ? 'length unknown' : `${probe.length} bytes`,
  ];
  const from = probe.host ? ` from ${probe.host}` : '';
  const body = probe.text !== null ? `: "${probe.text}"` : probe.hex ? `: starts with ${probe.hex}` : '';
  const codecs = probe.codecs.length ? ` (codecs: ${probe.codecs.join(', ')})` : '';
  return `${parts.join(', ')}${from}${body}${codecs}`;
}

/** Video codecs by how players name them; a browser decodes h264, vp9 and av1, often not hevc or mpeg4/xvid. */
const CODEC_MARKERS: [string, string][] = [
  // Matroska CodecID
  ['V_MPEGH/ISO/HEVC', 'hevc'],
  ['V_MPEG4/ISO/AVC', 'h264'],
  ['V_MPEG4/ISO/ASP', 'mpeg4'],
  ['V_MPEG2', 'mpeg2'],
  ['V_VP9', 'vp9'],
  ['V_AV1', 'av1'],
  ['A_EAC3', 'eac3'],
  ['A_AC3', 'ac3'],
  ['A_DTS', 'dts'],
  ['A_TRUEHD', 'truehd'],
  ['A_AAC', 'aac'],
  ['A_OPUS', 'opus'],
  // MP4 sample entries
  ['hvc1', 'hevc'],
  ['hev1', 'hevc'],
  ['avc1', 'h264'],
  ['mp4v', 'mpeg4'],
  ['av01', 'av1'],
  ['ec-3', 'eac3'],
  ['ac-3', 'ac3'],
  ['dtsc', 'dts'],
  ['mp4a', 'aac'],
];

function codecsIn(bytes: Uint8Array): string[] {
  // Latin-1 keeps one character per byte, so the ASCII markers can be searched as text.
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const found: string[] = [];
  for (const [marker, codec] of CODEC_MARKERS) if (text.includes(marker) && !found.includes(codec)) found.push(codec);
  return found;
}

/** Recognises the usual provider answers instead of a video. */
export function probeHint(probe: StreamProbe): ProbeHint {
  const text = probe.text ?? '';
  if (/max(imum)?[\s_-]*connection|too many (connections|streams|devices)|connection limit|already (in use|streaming)/i.test(text))
    return 'connections';
  if (/expired|subscription (has )?ended|account (is )?(disabled|banned|suspended)/i.test(text)) return 'expired';
  if (probe.status === 404 || /not found|no such file|does not exist|404/i.test(text)) return 'not-found';
  if (probe.status === 401 || probe.status === 403 || /forbidden|access denied|not allowed|blocked/i.test(text)) return 'refused';
  if (!probe.error && probe.status >= 200 && probe.status < 300 && probe.length === 0) return 'empty';
  return null;
}

/** Error text for the player, from what the provider sent (null: keep the general message). */
export function probeMessage(hint: ProbeHint): string | null {
  switch (hint) {
    case 'connections':
      return t(
        'Your IPTV provider says all connections of the account are in use. Stop playback on the other device, wait a minute and try again.',
      );
    case 'expired':
      return t('Your IPTV provider says the subscription has expired or the account is blocked.');
    case 'not-found':
      return t('Your IPTV provider does not have the video file for this title (it is missing on their side). Try another version.');
    case 'refused':
      return t('Your IPTV provider refused this stream. Try again later, or another version.');
    case 'empty':
      return t('Your IPTV provider sent an empty answer instead of the video (it is broken on their side). Try another version.');
    default:
      return null;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function credentialsOf(url: string): string[] {
  const match = /\/(?:movie|series|live|timeshift)\/([^/]+)\/([^/]+)\//i.exec(url);
  const query = [...url.matchAll(/(?:username|password)=([^&]+)/gi)].map((m) => m[1]!);
  return [...(match ? [match[1]!, match[2]!] : []), ...query].map((value) => safeDecode(value)).filter((value) => value.length >= 3);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Text if almost all bytes are printable (or UTF-8), as error pages are; videos and binary playlists are not. */
function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  let control = 0;
  for (const byte of bytes) if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) control++;
  return control / bytes.length < 0.02;
}

function decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return String.fromCharCode(...bytes);
  }
}

function oneLine(text: string, secrets: string[]): string {
  let line = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const secret of secrets) line = line.split(secret).join('***');
  return line.length > TEXT_CHARS ? `${line.slice(0, TEXT_CHARS)}…` : line;
}
