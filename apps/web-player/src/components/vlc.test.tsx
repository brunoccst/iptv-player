// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');

const get = vi.fn(async () => ({ url: 'http://panel/movie/u/p/101.mkv' }));
const save = vi.fn(async () => undefined);
const progress = { items: { data: [] as { kind: string; itemId: string; positionSeconds: number; durationSeconds: number }[] } };
const session = { offline: false, activeProfileId: 'p1' as string | null };
vi.mock('../appContext', () => ({
  api: { playback: { get } },
  stores: {
    session: { getState: () => session, subscribe: () => () => undefined },
    progress: { getState: () => ({ ...progress, save }) },
  },
}));

describe('Open in VLC (desktop app, D-057)', () => {
  afterEach(() => {
    vi.resetModules();
    delete (globalThis as { iptvDesktop?: unknown }).iptvDesktop;
  });

  const movie = { kind: 'movie' as const, streamId: '101', container: 'mkv', title: 'Heat' };

  it('asks for the original file and hands it to VLC with the title', async () => {
    const openInVlc = vi.fn(async () => 'vlc' as const);
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc };
    const { openInVlc: open } = await import('./vlc');
    expect(await open(movie)).toBeNull();
    expect(get).toHaveBeenLastCalledWith('movie', '101', 'mkv');
    expect(openInVlc).toHaveBeenCalledWith('http://panel/movie/u/p/101.mkv', 'Heat', 0, undefined);
  });

  it('hands VLC the stream server when the portal does not answer with a video (D-088)', async () => {
    get.mockResolvedValueOnce({ url: 'http://portal/movie/u/p/101.mkv', alternateUrls: ['http://streams/movie/u/p/101.mkv'] } as never);
    const openInVlc = vi.fn(async () => 'vlc' as const);
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc };
    const fetch = vi.fn(async (url: string) =>
      url.startsWith('http://streams/')
        ? new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), { status: 206 })
        : new Response('', { status: 401 }),
    );
    vi.stubGlobal('fetch', fetch);
    const { openInVlc: open } = await import('./vlc');
    expect(await open(movie)).toBeNull();
    expect(openInVlc).toHaveBeenCalledWith('http://streams/movie/u/p/101.mkv', 'Heat', 0, undefined);
    vi.unstubAllGlobals();
  });

  it('keeps the portal address when it answers, and when nothing does', async () => {
    const { answeringUrl } = await import('./vlc');
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

  it('starts VLC at the saved progress and saves where it stops (issue #265)', async () => {
    progress.items.data = [{ kind: 'movie', itemId: '101', positionSeconds: 600, durationSeconds: 6000 }];
    let listener: ((p: { id: string; position: number; duration: number; ended: boolean }) => void) | null = null;
    const openInVlc = vi.fn(async (..._args: unknown[]) => 'vlc' as const);
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc, onVlcProgress: (l: typeof listener) => (listener = l) };
    const { openInVlc: open } = await import('./vlc');
    expect(await open(movie)).toBeNull();
    const [, , startAt, watchId] = openInVlc.mock.calls[0]!;
    expect(startAt).toBe(600);
    expect(typeof watchId).toBe('string');
    listener!({ id: 'someone-else', position: 1, duration: 6000, ended: true });
    expect(save).not.toHaveBeenCalled();
    listener!({ id: watchId as string, position: 1800, duration: 6000, ended: false });
    expect(save).toHaveBeenLastCalledWith('movie', '101', expect.objectContaining({ positionSeconds: 1800, durationSeconds: 6000 }));
    listener!({ id: watchId as string, position: 2400, duration: 6000, ended: true });
    expect(save).toHaveBeenLastCalledWith('movie', '101', expect.objectContaining({ positionSeconds: 2400 }));
    // Closed: later reports for that VLC are ignored.
    listener!({ id: watchId as string, position: 3000, duration: 6000, ended: true });
    expect(save).toHaveBeenCalledTimes(2);
    progress.items.data = [];
  });

  it('keeps the progress for the profile that opened VLC', async () => {
    save.mockClear();
    let listener: ((p: { id: string; position: number; duration: number; ended: boolean }) => void) | null = null;
    const openInVlc = vi.fn(async (..._args: unknown[]) => 'vlc' as const);
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc, onVlcProgress: (l: typeof listener) => (listener = l) };
    const { openInVlc: open } = await import('./vlc');
    await open(movie);
    session.activeProfileId = 'p2';
    listener!({ id: openInVlc.mock.calls[0]![3] as string, position: 1800, duration: 6000, ended: true });
    expect(save).not.toHaveBeenCalled();
    session.activeProfileId = 'p1';
  });

  it('says so when VLC is not installed', async () => {
    (globalThis as { iptvDesktop?: unknown }).iptvDesktop = { openInVlc: vi.fn(async () => 'none' as const) };
    const { openInVlc: open } = await import('./vlc');
    expect(await open(movie)).toMatch(/VLC is not installed/);
  });

  it('does nothing in a browser', async () => {
    const { openInVlc: open } = await import('./vlc');
    expect(await open(movie)).toBeNull();
  });
});
