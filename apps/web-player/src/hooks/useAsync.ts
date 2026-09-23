import { useEffect, useState } from 'react';
import { ApiError } from '@iptv/shared';

const cache = new Map<string, unknown>();

export interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/** Loads `key` once per page session (module cache). `key` null = idle. For ad-hoc reads outside the shared stores. */
export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncResult<T> {
  const [state, setState] = useState<AsyncResult<T>>(() =>
    key && cache.has(key) ? { data: cache.get(key) as T, loading: false, error: null } : { data: null, loading: !!key, error: null });

  useEffect(() => {
    if (!key) return setState({ data: null, loading: false, error: null });
    if (cache.has(key)) return setState({ data: cache.get(key) as T, loading: false, error: null });
    let active = true;
    setState({ data: null, loading: true, error: null });
    load().then(
      (data) => {
        cache.set(key, data);
        if (active) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (active) setState({ data: null, loading: false, error: error instanceof ApiError ? error : new ApiError(0, 'http_error', String(error)) });
      },
    );
    return () => {
      active = false;
    };
    // `load` is expected to change with `key`; keying on it alone avoids refetch loops from inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export const clearAsyncCache = () => cache.clear();
