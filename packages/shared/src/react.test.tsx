// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { useAppStore } from './react';

describe('useAppStore', () => {
  it('accepts selectors that build new arrays without looping', () => {
    const store = createStore<{ items: number[] | undefined }>()(() => ({ items: undefined }));
    let renders = 0;
    function View() {
      renders++;
      const doubled = useAppStore(store, (s) => (s.items ?? []).map((n) => n * 2));
      return <span>{doubled.join(',')}</span>;
    }

    const { container } = render(<View />);
    act(() => store.setState({ items: [1, 2] }));

    expect(container.textContent).toBe('2,4');
    expect(renders).toBeLessThan(5);
  });
});

describe('useEpgGuide', () => {
  it('concatenates pages and restarts watchers after refresh', async () => {
    const { createApiClient } = await import('./api/apiClient');
    const { createHttpClient } = await import('./api/httpClient');
    const { createFakeBackend } = await import('./testing/fakeBackend');
    const { createEpgStore } = await import('./stores/epgStore');
    const { useEpgGuide } = await import('./react');
    const backend = createFakeBackend();
    let calls = 0;
    backend.on('GET', '/api/epg', ({ url }) => {
      calls++;
      const offset = Number(url.searchParams.get('offset'));
      return { body: { status: 'ready', updatedAt: null, from: '', to: '', totalChannels: 3,
        channels: [{ channel: { id: `c${offset}`, name: `C${offset}` }, programmes: [] }] } };
    });
    backend.on('POST', '/api/epg/refresh', { status: 202 });
    const store = createEpgStore({ api: createApiClient(createHttpClient({ baseUrl: 'http://api.test', fetch: backend.fetch })) });

    function View({ pages }: { pages: number }) {
      const guide = useEpgGuide(store, { categoryId: null, from: 0, hours: 3 }, pages, 1);
      return <span>{guide.loading ? 'loading' : `${guide.rows.map((r) => r.channel.id).join(',')}/${guide.totalChannels}`}</span>;
    }

    const { container, rerender } = render(<View pages={1} />);
    await act(async () => {});
    expect(container.textContent).toBe('c0/3');

    rerender(<View pages={2} />);
    await act(async () => {});
    expect(container.textContent).toBe('c0,c1/3');

    await act(async () => void (await store.getState().refresh()));
    await act(async () => {});
    expect(container.textContent).toBe('c0,c1/3');
    expect(calls).toBe(4);
  });
});
