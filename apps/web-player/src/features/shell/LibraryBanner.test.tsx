// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LibraryStatus } from '@iptv/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenHostProvider, type ScreenHost } from '@iptv/screens';

const state = {
  offline: false,
  providerDown: false,
  providerReply: null as string | null,
  syncing: false,
  status: { data: null as LibraryStatus[] | null },
  refreshStatus: vi.fn(async () => undefined),
  invalidate: vi.fn(),
  sync: vi.fn(async () => undefined),
};
vi.mock('../../appContext', () => ({
  stores: { library: { getState: () => state } },
  uiStore: { getState: () => ({ bumpLibrary: vi.fn() }) },
}));
vi.mock('../../hooks/stores', () => ({
  useLibrary: (select: (s: typeof state) => unknown) => select(state),
  useSession: (select: (s: typeof state) => unknown) => select(state),
}));
vi.mock('../browse/screenHost', () => ({}));

const host = {
  hooks: {
    useLibrary: (select: (s: typeof state) => unknown) => select(state),
    useSession: (select: (s: typeof state) => unknown) => select(state),
  },
} as unknown as ScreenHost;

const status = (mediaKind: string, jobStatus: string, itemCount: number | null, masterCount = 0): LibraryStatus => ({
  error: null,
  finishedAt: null,
  itemCount,
  jobStatus,
  masterCount,
  mediaKind,
  queuedAt: null,
});

describe('library banner (D-119, D-215)', () => {
  afterEach(cleanup);

  const show = async () => {
    const { LibraryBanner } = await import('./LibraryBanner');
    render(
      <ScreenHostProvider value={host}>
        <LibraryBanner />
      </ScreenHostProvider>,
    );
  };

  it('floats at the bottom with one progress line per kind, as on TV', async () => {
    state.status.data = [status('movie', 'processing', 1200), status('series', 'pending', null)];
    await show();
    const banner = screen.getByTestId('library-processing');
    expect(getComputedStyle(banner).position).toBe('fixed');
    expect(banner.textContent).toContain('Organizing your library');
    expect(banner.textContent).toContain('Movies: grouping 1,200 titles…');
    expect(banner.textContent).toContain('Series: waiting to start…');
  });

  it('an empty library offers Refresh library', async () => {
    state.status.data = [status('movie', 'done', 0), status('series', 'done', 0)];
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh library' }));
    expect(state.sync).toHaveBeenCalled();
  });

  it('offline, the connection banner speaks instead, with its icon; the library banner stays away (DECISIONS.md#d-230)', async () => {
    const { ConnectionBanner } = await import('./LibraryBanner');
    const showConnection = () =>
      render(
        <ScreenHostProvider value={host}>
          <ConnectionBanner />
        </ScreenHostProvider>,
      );
    state.status.data = [status('movie', 'processing', 10)];
    Object.assign(state, { offline: true, providerDown: true, providerReply: 'Error. Page cannot be displayed.' });
    await show();
    expect(screen.queryByTestId('library-processing')).toBeNull();
    showConnection();
    const banner = screen.getByTestId('connection-banner');
    expect(banner.textContent).toContain('Your IPTV provider is unavailable right now.');
    expect(screen.getByTestId('connection-banner-reply').textContent).toBe('Your provider says: "Error. Page cannot be displayed."');
    expect(banner.textContent).toContain('account menu → IPTV account');
    expect(banner.querySelector('svg')).not.toBeNull();
    cleanup();
    Object.assign(state, { providerDown: false, providerReply: null });
    showConnection();
    expect(screen.getByTestId('connection-banner').textContent).toBe("You're offline. Downloaded titles are available in My Downloads.");
    cleanup();
    state.offline = false;
    showConnection();
    expect(screen.queryByTestId('connection-banner')).toBeNull();
  });

  it('shows nothing once the library is ready', async () => {
    state.status.data = [status('movie', 'done', 10, 8)];
    await show();
    expect(screen.queryByTestId('library-processing')).toBeNull();
  });
});
