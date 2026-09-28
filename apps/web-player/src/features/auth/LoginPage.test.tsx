// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');

describe('LoginPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('signs in with the provider directly and shows its refusal in plain language (D-088)', async () => {
    const { createFakePanel } = await import('../../../../../packages/shared/src/testing/fakePanel');
    const panel = createFakePanel();
    vi.stubGlobal('fetch', panel.fetch);
    const { LoginPage } = await import('./LoginPage');

    render(<LoginPage />);
    expect(screen.queryByText('My server')).toBeNull();
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'http://panel.test:8080' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    // The first sign-in also sets up the device's storage: allow more than the default second on a busy machine.
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveProperty('textContent', 'Your IPTV provider rejected this username or password.');
    expect(panel.calls.length).toBeGreaterThan(0);
    expect(panel.calls.every((url) => url.startsWith('http://panel.test:8080/player_api.php?'))).toBe(true);
  });
});
