import type { KeyValueStorage } from '../stores/storage';

/** In-app diagnostics log: a ring buffer the user can export (TV "Log" screen). Credentials are masked on the way in. */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  at: string;
  level: LogLevel;
  area: string;
  message: string;
}

/** Masks Xtream credentials in query strings and stream paths (`/movie/<user>/<pass>/…`). */
export function redact(text: string): string {
  return text
    .replace(/((?:username|password)=)[^&\s"']+/gi, '$1***')
    .replace(/\/(movie|series|live|timeshift)\/[^/\s"']+\/[^/\s"']+\//gi, '/$1/***/***/');
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
  /** Loads the previous session's lines and saves new ones (throttled) so a restart does not lose them. */
  persist(storage: KeyValueStorage, key?: string): Promise<void>;
}

/** Share sheets and chat apps cut long texts; this keeps the newest part well below that. */
export const SHARE_MAX_CHARS = 15_000;

export function createLogger({ limit = 600, now = () => new Date() }: { limit?: number; now?: () => Date } = {}): Logger {
  let items: LogEntry[] = [];
  let save: (() => void) | null = null;

  const add = (level: LogLevel, area: string, message: string) => {
    items.push({ at: now().toISOString(), level, area, message: redact(message) });
    if (items.length > limit) items = items.slice(-limit);
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
    async persist(storage, key = 'diagnostics.log') {
      try {
        const previous = JSON.parse((await storage.getItem(key)) ?? '[]') as LogEntry[];
        if (Array.isArray(previous) && previous.length > 0) {
          items = [
            ...previous,
            { at: now().toISOString(), level: 'info' as const, area: 'app', message: '--- app started ---' },
            ...items,
          ].slice(-limit);
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
