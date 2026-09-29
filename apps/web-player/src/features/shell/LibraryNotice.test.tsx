// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { afterEach, describe, expect, it, vi } from 'vitest';

const library = createStore<{ refreshNotice: string | null; dismissRefreshNotice(): void }>((set) => ({
  refreshNotice: null,
  dismissRefreshNotice: () => set({ refreshNotice: null }),
}));
vi.mock('../../appContext', () => ({ api: {}, stores: { library }, downloadsStore: library, uiStore: library }));

describe('"Refresh library" result (D-119)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows what the refresh did, and goes after a few seconds or on Close', async () => {
    const { LibraryNotice, NOTICE_MS } = await import('./LibraryBanner');
    vi.useFakeTimers();
    render(<LibraryNotice />);
    expect(screen.queryByTestId('library-notice')).toBeNull();

    act(() => library.setState({ refreshNotice: 'Your library is up to date: nothing new from your provider.' }));
    expect(screen.getByRole('status').textContent).toContain('Your library is up to date');
    act(() => void vi.advanceTimersByTime(NOTICE_MS));
    expect(screen.queryByTestId('library-notice')).toBeNull();

    act(() => library.setState({ refreshNotice: 'Library updated: 1 new, 0 changed and 0 removed titles.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('library-notice')).toBeNull();
  });
});
