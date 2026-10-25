// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LibraryStatus } from '@iptv/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenHostProvider, type ScreenHost } from '@iptv/screens';

const state = {
  offline: false,
  providerDown: false,
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

  it('says the provider is unavailable when it answers but the network works (DECISIONS.md#d-227)', async () => {
    state.status.data = [status('movie', 'done', 10, 8)];
    Object.assign(state, { offline: true, providerDown: true });
    await show();
    expect(screen.getByTestId('library-processing').textContent).toBe(
      'Your IPTV provider is unavailable right now. Downloaded titles are available in My Downloads.',
    );
    cleanup();
    state.providerDown = false;
    await show();
    expect(screen.getByTestId('library-processing').textContent).toBe("You're offline. Downloaded titles are available in My Downloads.");
    state.offline = false;
  });

  it('shows nothing once the library is ready', async () => {
    state.status.data = [status('movie', 'done', 10, 8)];
    await show();
    expect(screen.queryByTestId('library-processing')).toBeNull();
  });
});
