// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');
vi.stubEnv('APP_API_BASE_URL', 'http://api.test');

const NOW = Date.parse('2026-09-23T12:10:00Z');
const at = (minutes: number) => new Date(Date.parse('2026-09-23T12:00:00Z') + minutes * 60_000).toISOString();
const channel = (id: string, name: string) => ({
  id,
  name,
  categoryId: '1',
  number: Number(id),
  logoUrl: null,
  epgChannelId: null,
  hasCatchup: false,
});

function guideResponse(url: URL) {
  const offset = Number(url.searchParams.get('offset'));
  const channels =
    offset === 0
      ? [
          {
            channel: channel('1', 'News HD'),
            programmes: [
              { start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' },
              { start: at(30), end: at(90), title: 'World Report', description: null },
            ],
          },
          { channel: channel('2', 'Quiet'), programmes: [] },
        ]
      : [{ channel: channel('3', 'Late Channel'), programmes: [] }];
  return { status: 'ready', updatedAt: at(0), from: url.searchParams.get('from'), to: at(180), totalChannels: 3, channels };
}

describe('LiveTvPage (guide)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows the grid, selects a programme and plays its channel with the programme as subtitle', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const requests: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input);
        requests.push(url);
        const body = url.pathname === '/api/epg' ? guideResponse(url) : [{ id: '1', name: 'News', kind: 'live' }];
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      }),
    );
    const { LiveTvPage } = await import('./LiveTvPage');
    const { uiStore } = await import('../../appContext');
    const play = vi.spyOn(uiStore.getState(), 'play').mockImplementation(() => {});

    render(<LiveTvPage />);

    const current = await screen.findByRole('button', { name: /^Morning Briefing,/ });
    expect(current.className).toContain('guide__programme--now');
    expect(screen.getByText('No guide information')).toBeTruthy();
    const epg = requests.find((u) => u.pathname === '/api/epg')!;
    expect(epg.searchParams.get('from')).toBe('2026-09-23T12:00:00.000Z');
    expect(epg.searchParams.get('hours')).toBe('3');

    fireEvent.click(current);
    const details = screen.getByRole('region', { name: 'Programme details' });
    expect(details.textContent).toContain('Top stories.');
    expect(details.textContent).toContain('On now');
    fireEvent.click(screen.getByRole('button', { name: 'Watch live' }));
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'live', streamId: '1', title: 'News HD', subtitle: 'Morning Briefing' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'More channels (2 of 3)' }));
    expect(await screen.findByRole('button', { name: 'Watch Late Channel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /More channels/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Later ▶' }));
    await act(async () => {});
    expect(requests.at(-1)!.searchParams.get('from')).toBe('2026-09-23T13:00:00.000Z');
  });
});
