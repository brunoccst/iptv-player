import { describe, expect, it, vi } from 'vitest';
import { createFakeBackend } from '../testing/fakeBackend';
import { ApiError, buildQuery, createHttpClient } from './httpClient';

describe('createHttpClient', () => {
  it('sends JSON, bearer token and parses JSON responses', async () => {
    const backend = createFakeBackend();
    backend.on('POST', '/api/thing', ({ body }) => ({ body: { echoed: body } }));
    const http = createHttpClient({ baseUrl: 'http://api.test/', fetch: backend.fetch, getToken: () => 'tok' });

    const result = await http.request<{ echoed: unknown }>('POST', '/api/thing', { body: { a: 1 } });

    expect(result).toEqual({ echoed: { a: 1 } });
    expect(backend.calls[0]!.url.href).toBe('http://api.test/api/thing');
    expect(backend.calls[0]!.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
  });

  it('omits Authorization when signed out and returns undefined for 204', async () => {
    const backend = createFakeBackend();
    backend.on('DELETE', '/api/x', { status: 204 });
    const http = createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch, getToken: () => null });

    await expect(http.request('DELETE', '/api/x')).resolves.toBeUndefined();
    expect(backend.calls[0]!.headers.Authorization).toBeUndefined();
  });

  it('maps problem responses to ApiError with backend code', async () => {
    const backend = createFakeBackend();
    backend.on('GET', '/api/x', { status: 502, body: { title: 'IPTV provider error', detail: 'down', code: 'provider_unavailable' } });
    const http = createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch });

    const error = await http.request('GET', '/api/x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'provider_unavailable', message: 'down' });
  });

  it('uses fallback codes when there is no problem body', async () => {
    const backend = createFakeBackend();
    const http = createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch });

    await expect(http.request('GET', '/missing')).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  it('calls onUnauthorized only when a token was sent', async () => {
    const backend = createFakeBackend();
    backend.on('GET', '/api/me', { status: 401 });
    const onUnauthorized = vi.fn();
    let token: string | null = null;
    const http = createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch, getToken: () => token, onUnauthorized });

    await expect(http.request('GET', '/api/me')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(onUnauthorized).not.toHaveBeenCalled();

    token = 'expired';
    await expect(http.request('GET', '/api/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('reports network errors, timeouts and caller aborts distinctly', async () => {
    const backend = createFakeBackend();
    backend.on('GET', '/down', { networkError: true });
    const hanging: typeof fetch = (_input, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));

    const http = createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch });
    await expect(http.request('GET', '/down')).rejects.toMatchObject({ status: 0, code: 'network_error' });

    const slow = createHttpClient({ baseUrl: 'http://api.test', fetch: hanging, timeoutMs: 10 });
    await expect(slow.request('GET', '/slow')).rejects.toMatchObject({ code: 'timeout' });

    const controller = new AbortController();
    const pending = createHttpClient({ baseUrl: 'http://api.test', fetch: hanging }).request('GET', '/slow', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('buildQuery', () => {
  it('encodes values and drops empty ones', () => {
    expect(buildQuery({ a: 'x y', b: 0, c: null, d: undefined, e: '', f: true })).toBe('?a=x%20y&b=0&f=true');
    expect(buildQuery({})).toBe('');
    expect(buildQuery(undefined)).toBe('');
  });
});
