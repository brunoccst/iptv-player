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
  /** Plain text for sharing: one line per entry, oldest first. */
  text(): string;
  clear(): void;
  /** Loads the previous session's lines and saves new ones (throttled) so a restart does not lose them. */
  persist(storage: KeyValueStorage, key?: string): Promise<void>;
}

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
