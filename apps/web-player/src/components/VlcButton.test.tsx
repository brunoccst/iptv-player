// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');
vi.stubEnv('APP_API_BASE_URL', 'http://api.test');

const get = vi.fn(async () => ({ url: 'http://panel/movie/u/p/101.mkv' }));
vi.mock('../appContext', () => ({
  api: { playback: { get } },
  stores: { session: { getState: () => ({ offline: false }) } },
}));

describe('Open in VLC (desktop app, D-081)', () => {
  afterEach(() => {
    vi.resetModules();
    delete (globalThis as { iptvDesktop?: unknown }).iptvDesktop;
  });

  const movie = { kind: 'movie' as const, streamId: '101', container: 'mkv', title: 'Heat' };

  it('asks for the original file and hands it to VLC with the title', async () => {
    const openInVlc = vi.fn(async () => 'vlc' as const);
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc };
    const { openInVlc: open } = await import('./VlcButton');
    expect(await open(movie)).toBeNull();
    expect(get).toHaveBeenLastCalledWith('movie', '101', 'mkv');
    expect(openInVlc).toHaveBeenCalledWith('http://panel/movie/u/p/101.mkv', 'Heat');
  });

  it('says so when VLC is not installed', async () => {
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc: vi.fn(async () => 'none' as const) };
    const { openInVlc: open } = await import('./VlcButton');
    expect(await open(movie)).toMatch(/VLC is not installed/);
  });

  it('does nothing in a browser', async () => {
    const { openInVlc: open } = await import('./VlcButton');
    expect(await open(movie)).toBeNull();
  });
});
