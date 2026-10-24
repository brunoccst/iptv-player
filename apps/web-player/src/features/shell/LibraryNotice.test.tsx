// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryNotice, NOTICE_MS, ScreenHostProvider, type ScreenHost } from '@iptv/screens';

type Library = { refreshNotice: string | null; dismissRefreshNotice(): void };
const library = createStore<Library>((set) => ({
  refreshNotice: null,
  dismissRefreshNotice: () => set({ refreshNotice: null }),
}));
const host = {
  hooks: { useLibrary: <T,>(select: (s: Library) => T) => useStore(library, select) },
  stores: { library },
} as unknown as ScreenHost;

describe('"Refresh library" result (D-119)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows what the refresh did, and goes after a few seconds or on Close', () => {
    vi.useFakeTimers();
    render(
      <ScreenHostProvider value={host}>
        <LibraryNotice />
      </ScreenHostProvider>,
    );
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
