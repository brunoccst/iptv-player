// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { UpdateProgress as Progress } from '../../desktop';

describe('desktop update download (D-166)', () => {
  afterEach(() => {
    cleanup();
    delete (globalThis as { iptvDesktop?: unknown }).iptvDesktop;
  });

  it('shows the download and its percentage until the main process says it ended', async () => {
    let send: (progress: Progress | null) => void = () => {};
    let unsubscribed = false;
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = {
      onUpdateProgress(listener: (progress: Progress | null) => void) {
        send = listener;
        return () => (unsubscribed = true);
      },
    };
    const { UpdateProgress } = await import('./UpdateProgress');
    const { unmount } = render(<UpdateProgress />);
    expect(screen.queryByTestId('update-progress')).toBeNull();

    act(() => send({ version: '1.0.7', percent: 0 }));
    expect(screen.getByRole('status').textContent).toBe('Downloading version 1.0.7… 0%');
    act(() => send({ version: '1.0.7', percent: 42.6 }));
    expect(screen.getByRole('status').textContent).toBe('Downloading version 1.0.7… 42%');

    act(() => send(null));
    expect(screen.queryByTestId('update-progress')).toBeNull();
    unmount();
    expect(unsubscribed).toBe(true);
  });
});
