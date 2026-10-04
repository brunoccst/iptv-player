// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');

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

  it('hands VLC the stream server when the portal does not answer with a video (D-038)', async () => {
    get.mockResolvedValueOnce({ url: 'http://portal/movie/u/p/101.mkv', alternateUrls: ['http://streams/movie/u/p/101.mkv'] } as never);
    const openInVlc = vi.fn(async () => 'vlc' as const);
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc };
    const fetch = vi.fn(async (url: string) =>
      url.startsWith('http://streams/')
        ? new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), { status: 206 })
        : new Response('', { status: 401 }),
    );
    vi.stubGlobal('fetch', fetch);
    const { openInVlc: open } = await import('./VlcButton');
    expect(await open(movie)).toBeNull();
    expect(openInVlc).toHaveBeenCalledWith('http://streams/movie/u/p/101.mkv', 'Heat');
    vi.unstubAllGlobals();
  });

  it('keeps the portal address when it answers, and when nothing does', async () => {
    const { answeringUrl } = await import('./VlcButton');
    const probe =
      (status: number, text: string | null = null) =>
      async () => ({ status, contentType: null, length: 10, host: null, text, hex: null, error: null, codecs: [] });
    expect(await answeringUrl(['http://portal/a.mkv', 'http://streams/a.mkv'], probe(206))).toBe('http://portal/a.mkv');
    expect(await answeringUrl(['http://portal/a.m3u8', 'http://streams/a.m3u8'], probe(200, '#EXTM3U #EXT-X-VERSION:3'))).toBe(
      'http://portal/a.m3u8',
    );
    expect(await answeringUrl(['http://portal/a.mkv', 'http://streams/a.mkv'], probe(200, 'max connections reached'))).toBe(
      'http://portal/a.mkv',
    );
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
