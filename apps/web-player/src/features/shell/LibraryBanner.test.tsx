// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { LibraryStatus } from '@iptv/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = {
  offline: false,
  syncing: false,
  status: { data: null as LibraryStatus[] | null },
  refreshStatus: vi.fn(async () => undefined),
  invalidate: vi.fn(),
};
vi.mock('../../appContext', () => ({
  stores: { library: { getState: () => state } },
  uiStore: { getState: () => ({ bumpLibrary: vi.fn() }) },
}));
vi.mock('../../hooks/stores', () => ({
  useLibrary: (select: (s: typeof state) => unknown) => select(state),
  useSession: (select: (s: typeof state) => unknown) => select(state),
}));

const status = (mediaKind: string, jobStatus: string, itemCount: number | null): LibraryStatus => ({
  error: null,
  finishedAt: null,
  itemCount,
  jobStatus,
  masterCount: 0,
  mediaKind,
  queuedAt: null,
});

describe('library banner (D-142)', () => {
  afterEach(cleanup);

  it('floats at the bottom with one progress line per kind, as on TV', async () => {
    const { LibraryBanner } = await import('./LibraryBanner');
    state.status.data = [status('movie', 'processing', 1200), status('series', 'pending', null)];
    render(<LibraryBanner />);
    const banner = screen.getByTestId('library-processing');
    expect(banner.className).toContain('banner--floating');
    expect(banner.textContent).toContain('Organizing your library');
    expect(banner.textContent).toContain('Movies: grouping 1,200 titles…');
    expect(banner.textContent).toContain('Series: waiting to start…');
  });
});
