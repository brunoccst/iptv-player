import type { ApiErrorCode, ProblemDetails } from './types';

export type QueryValue = string | number | boolean | null | undefined;

export interface HttpClientOptions {
  baseUrl: string;
  /** Returns the current bearer token, or null when signed out. Read on every request. */
  getToken?: () => string | null;
  /** Called when a request that carried a token gets 401 (session expired or revoked). */
  onUnauthorized?: () => void;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});
  readonly problem: ProblemDetails | null;

  constructor(status: number, code: ApiErrorCode | (string & {}), message: string, problem: ProblemDetails | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.problem = problem;
  }
}

export interface HttpClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async request<T>(method: string, path: string, { query, body, signal }: RequestOptions = {}): Promise<T> {
      const fetchImpl = options.fetch ?? globalThis.fetch;
      const token = options.getToken?.() ?? null;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      // Manual timeout + caller signal: AbortSignal.any is not available on every React Native runtime.
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const forwardAbort = () => controller.abort();
      signal?.addEventListener('abort', forwardAbort);

      let response: Response;
      try {
        response = await fetchImpl(baseUrl + path + buildQuery(query), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut) throw new ApiError(0, 'timeout', `Request timed out after ${timeoutMs} ms: ${method} ${path}`);
        if (signal?.aborted) throw new ApiError(0, 'aborted', `Request aborted: ${method} ${path}`);
        throw new ApiError(0, 'network_error', `Network error: ${method} ${path} (${String(error)})`);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', forwardAbort);
      }

      if (response.ok) {
        return (await readJson(response)) as T;
      }

      if (response.status === 401 && token) {
        options.onUnauthorized?.();
      }
      throw await toApiError(response, method, path);
    },
  };
}

export function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 202) return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function toApiError(response: Response, method: string, path: string): Promise<ApiError> {
  let problem: ProblemDetails | null = null;
  if (response.headers.get('content-type')?.includes('json')) {
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = null;
    }
  }

  const fallbackCode = response.status === 401 ? 'unauthorized' : response.status === 404 ? 'not_found' : 'http_error';
  const message = problem?.detail ?? problem?.title ?? `${method} ${path} failed with HTTP ${response.status}`;
  return new ApiError(response.status, problem?.code ?? fallbackCode, message, problem);
}
