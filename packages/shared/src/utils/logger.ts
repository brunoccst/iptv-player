import type { KeyValueStorage } from '../stores/storage';

/** In-app diagnostics log: a ring buffer the user can export (TV "Log" screen). Credentials are masked on the way in. */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  at: string;
  level: LogLevel;
  area: string;
  message: string;
}

/** Public services whose addresses help reading the log and give nothing away. */
const PUBLIC_HOSTS = /(^|\.)(themoviedb\.org|tmdb\.org|opensubtitles\.(com|org)|github\.com|githubusercontent\.com)$/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
/** Shorter values (a 2-letter username) would mask ordinary words and numbers all over the log. */
const MIN_SECRET_LENGTH = 3;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Masks what could identify the provider or the person (D-173): the given `secrets` (server address, usernames,
 * passwords, keys) wherever they appear, credentials in queries and stream paths (`/movie/<user>/<pass>/…`), the server
 * of every URL except public services, keys and tokens, e-mail addresses, IP addresses and `host:port`.
 */
export function redact(text: string, secrets: Iterable<string> = []): string {
  let masked = text;
  const known = [...new Set(secrets)].filter((secret) => secret.length >= MIN_SECRET_LENGTH).sort((a, b) => b.length - a.length);
  for (const secret of known) masked = masked.replace(new RegExp(escapeRegExp(secret), 'gi'), '***');
  return (
    masked
      .replace(/\b((?:username|password|user|pass|pwd|token|access_token|api_key|apikey|key|auth|sig|signature)=)[^&\s"']+/gi, '$1***')
      .replace(/\/(movie|series|live|timeshift)\/[^/\s"']+\/[^/\s"']+\//gi, '/$1/***/***/')
      .replace(/\b([a-z][a-z0-9+.-]*:\/\/)([^/\s"'?#]+)/gi, (all, scheme: string, authority: string) => {
        const host = authority
          .replace(/^.*@/, '')
          .replace(/:\d+$/, '')
          .replace(/^\[|\]$/g, '');
        return LOCAL_HOSTS.has(host.toLowerCase()) || PUBLIC_HOSTS.test(host) ? all : `${scheme}***`;
      })
      .replace(/(Bearer\s+)[^\s"',]+/gi, '$1***')
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '***@***')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (ip) => (LOCAL_HOSTS.has(ip) ? ip : '***'))
      // `host:port`, but not `File.kt:89` in a stack trace.
      .replace(/\b(?:[a-z0-9-]+\.)+(?!(?:java|kt|kts|js|jsx|ts|tsx|mjs|cjs|json|py|cpp|cc|h|m|mm|swift)\b)[a-z]{2,}:\d{2,5}\b/gi, '***')
  );
}

export interface Logger {
  info(area: string, message: string): void;
  warn(area: string, message: string): void;
  error(area: string, message: string): void;
  entries(): LogEntry[];
  /** Plain text: one line per entry, oldest first. */
  text(): string;
  /**
   * Text for the share sheet, which apps cut off after some kilobytes: repeated lines (same area and message apart
   * from timings) are folded into one with a count, and only the newest lines that fit `maxChars` are kept.
   */
  shareText(maxChars?: number): { text: string; lines: number; omitted: number };
  clear(): void;
  /**
   * Masks these values (server address, usernames, passwords, keys) wherever they appear, in new lines and in lines
   * already kept (for example from before an update with better masking).
   */
  hide(...values: (string | null | undefined)[]): void;
  /** Loads the previous session's lines and saves new ones (throttled) so a restart does not lose them. */
  persist(storage: KeyValueStorage, key?: string): Promise<void>;
}

/** Lines older than this are dropped (at start-up and while logging), so the log only covers recent days. */
export const LOG_MAX_AGE_MS = 3 * 24 * 3600_000;

/** Share sheets and chat apps cut long texts; this keeps the newest part well below that. */
export const SHARE_MAX_CHARS = 15_000;

export function createLogger({
  limit = 600,
  maxAgeMs = LOG_MAX_AGE_MS,
  now = () => new Date(),
}: { limit?: number; maxAgeMs?: number; now?: () => Date } = {}): Logger {
  let items: LogEntry[] = [];
  let save: (() => void) | null = null;
  const secrets = new Set<string>();
  /** Lines kept from before (an older version, or before a value was hidden) are masked again; unchanged ones stay as they are. */
  const remask = () => {
    items = items.map((entry) => {
      const message = redact(entry.message, secrets);
      return message === entry.message ? entry : { ...entry, message };
    });
  };

  /** Newest `limit` lines of the last `maxAgeMs`. ISO timestamps compare as text. */
  const trim = (entries: LogEntry[]) => {
    const oldest = new Date(now().getTime() - maxAgeMs).toISOString();
    const first = entries.findIndex((entry) => entry.at >= oldest);
    return (first < 0 ? [] : entries.slice(first)).slice(-limit);
  };

  const add = (level: LogLevel, area: string, message: string) => {
    items.push({ at: now().toISOString(), level, area, message: redact(message, secrets) });
    if (items.length > limit || items[0]!.at < new Date(now().getTime() - maxAgeMs).toISOString()) items = trim(items);
    save?.();
  };
  const line = (entry: LogEntry) => `${entry.at} ${entry.level.toUpperCase().padEnd(5)} [${entry.area}] ${entry.message}`;

  return {
    info: (area, message) => add('info', area, message),
    warn: (area, message) => add('warn', area, message),
    error: (area, message) => add('error', area, message),
    entries: () => [...items],
    text: () => items.map(line).join('\n'),
    shareText(maxChars = SHARE_MAX_CHARS) {
      // Consecutive entries that differ only in timings ("in 104 ms") become one line with a count.
      const runs: { key: string; first: LogEntry; count: number }[] = [];
      for (const entry of items) {
        const key = `${entry.level}|${entry.area}|${entry.message.replace(/\d+ ms\b/g, '')}`;
        const last = runs[runs.length - 1];
        if (last?.key === key) last.count++;
        else runs.push({ key, first: entry, count: 1 });
      }
      const folded = runs.map((run) => line(run.first) + (run.count > 1 ? ` (×${run.count} until the next line)` : ''));
      const kept: string[] = [];
      let size = 0;
      for (let i = folded.length - 1; i >= 0; i--) {
        size += folded[i]!.length + 1;
        if (size > maxChars) break;
        kept.unshift(folded[i]!);
      }
      return { text: kept.join('\n'), lines: kept.length, omitted: folded.length - kept.length };
    },
    clear: () => {
      items = [];
      save?.();
    },
    hide: (...values) => {
      const before = secrets.size;
      for (const value of values) {
        const trimmed = value?.trim();
        if (trimmed) secrets.add(trimmed);
      }
      if (secrets.size === before) return;
      remask();
      save?.();
    },
    async persist(storage, key = 'diagnostics.log') {
      try {
        const previous = JSON.parse((await storage.getItem(key)) ?? '[]') as LogEntry[];
        if (Array.isArray(previous) && previous.length > 0) {
          items = trim([
            ...previous,
            { at: now().toISOString(), level: 'info' as const, area: 'app', message: '--- app started ---' },
            ...items,
          ]);
          remask();
        }
      } catch {
        // A broken log file is not worth failing over.
      }
      let timer: ReturnType<typeof setTimeout> | null = null;
      save = () => {
        timer ??= setTimeout(() => {
          timer = null;
          void Promise.resolve(storage.setItem(key, JSON.stringify(items))).catch(() => undefined);
        }, 2000);
      };
      save();
    },
  };
}

/** Shared app-wide log. */
export const appLog = createLogger();

export const errorMessage = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));
