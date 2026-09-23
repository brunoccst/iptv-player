import { ApiError } from '../api/httpClient';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

/** One cached remote value with its loading state. */
export interface Resource<T> {
  data: T | null;
  status: ResourceStatus;
  error: ApiError | null;
  updatedAt: number | null;
}

export const emptyResource = <T>(): Resource<T> => ({ data: null, status: 'idle', error: null, updatedAt: null });

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'http_error', String(error));
}

export interface LoadOptions {
  /** Reload even if data is cached. */
  force?: boolean;
}

export interface ResourceLoader<T> {
  load(key: string, fetcher: () => Promise<T>, options?: LoadOptions): Promise<T | null>;
  /** Forgets in-flight requests; their results are dropped instead of written (use on store reset). */
  invalidate(): void;
}

/**
 * Loads `key` into a `Record<string, Resource<T>>` slice. Skips cached keys unless forced.
 * Concurrent calls for the same key share one request.
 */
export function createResourceLoader<T>(
  read: () => Record<string, Resource<T>>,
  write: (key: string, resource: Resource<T>) => void,
  now: () => number = Date.now,
): ResourceLoader<T> {
  const inFlight = new Map<string, Promise<T | null>>();
  let generation = 0;

  return {
    invalidate() {
      generation++;
      inFlight.clear();
    },

    load(key, fetcher, { force = false } = {}) {
      const current = read()[key];
      if (!force && current?.status === 'success') return Promise.resolve(current.data);
      const pending = inFlight.get(key);
      if (pending) return pending;

      const startedIn = generation;
      const isStale = () => startedIn !== generation;
      write(key, { ...(current ?? emptyResource<T>()), status: 'loading', error: null });

      const promise = fetcher()
        .then((data) => {
          if (isStale()) return null;
          write(key, { data, status: 'success', error: null, updatedAt: now() });
          return data;
        })
        .catch((error: unknown) => {
          if (!isStale()) write(key, { ...(read()[key] ?? emptyResource<T>()), status: 'error', error: toApiError(error) });
          return null;
        })
        .finally(() => {
          if (inFlight.get(key) === promise) inFlight.delete(key);
        });

      inFlight.set(key, promise);
      return promise;
    },
  };
}
