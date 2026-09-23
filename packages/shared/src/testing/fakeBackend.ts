/** Test-only fake of the backend HTTP API. Not exported from the package. */
export interface FakeResponse {
  status?: number;
  body?: unknown;
  /** Throw instead of responding (simulates network failure). */
  networkError?: boolean;
}

export type FakeHandler = (request: { url: URL; init: RequestInit; body: unknown }) => FakeResponse | Promise<FakeResponse>;

export interface FakeBackend {
  fetch: typeof fetch;
  calls: { method: string; url: URL; headers: Record<string, string>; body: unknown }[];
  on(method: string, path: string, handler: FakeHandler | FakeResponse): void;
}

export function createFakeBackend(): FakeBackend {
  const routes = new Map<string, FakeHandler>();
  const calls: FakeBackend['calls'] = [];

  const fakeFetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, headers: { ...(init.headers as Record<string, string>) }, body });

    const handler = routes.get(`${method} ${url.pathname}`);
    const result = handler ? await handler({ url, init, body }) : { status: 404 };
    if (result.networkError) throw new TypeError('Network request failed');

    const status = result.status ?? 200;
    const hasBody = result.body !== undefined;
    return new Response(hasBody ? JSON.stringify(result.body) : null, {
      status,
      headers: hasBody ? { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } : {},
    });
  }) as typeof fetch;

  return {
    fetch: fakeFetch,
    calls,
    on(method, path, handler) {
      routes.set(`${method} ${path}`, typeof handler === 'function' ? handler : () => handler);
    },
  };
}

export const account = {
  id: 'acc-1',
  providerType: 'xtream',
  serverUrl: 'http://provider.test/',
  username: 'user',
  status: 'Active',
  expiresAt: null,
  maxConnections: 1,
};

export const profile = (id: string, name = id) => ({ id, name, avatarKey: null, isKids: false });
