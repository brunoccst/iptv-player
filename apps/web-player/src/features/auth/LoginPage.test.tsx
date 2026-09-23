// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');
vi.stubEnv('APP_API_BASE_URL', 'http://api.test');

describe('LoginPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends credentials and shows the provider error in plain language', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: 'Invalid', code: 'invalid_provider_credentials' }), {
      status: 401, headers: { 'content-type': 'application/problem+json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { LoginPage } = await import('./LoginPage');

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'http://panel:8080' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'me' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your IPTV provider rejected this username or password.');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/api/auth/login');
    expect(JSON.parse(String(init.body))).toEqual({ serverUrl: 'http://panel:8080', username: 'me', password: 'wrong' });
  });
});
