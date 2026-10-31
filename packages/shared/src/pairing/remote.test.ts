import { beforeEach, describe, expect, it } from 'vitest';
import {
  neighbourHosts,
  openRemoteRequest,
  REMOTE_PORTS,
  resetTvSearch,
  sendRemoteCommand,
  type PairedPhone,
  type PairedTv,
  type RemoteCommand,
} from './remote';

const key = (seed: number) => btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => (i * seed) % 256)));
const phone: PairedPhone = { phoneId: 'phone-1', key: key(3), pairedAt: '2026-09-26T10:00:00Z' };
const tv: PairedTv = { ...phone, tvId: 'tv-1', tvName: 'Living room TV', host: '192.168.1.20', port: REMOTE_PORTS[0]! };
const command: RemoteCommand = {
  type: 'play',
  accountId: 'acc-1',
  target: { kind: 'movie', streamId: '55', container: 'mkv', title: 'Big Movie' },
};
const now = new Date('2026-09-26T12:00:00Z');

/** A TV on `port` (at `host`) that plays whatever a paired phone sends. */
function fakeTv(port: number, phones: PairedPhone[], received: RemoteCommand[] = [], host = '192.168.1.20') {
  return (async (url: string, init?: RequestInit) => {
    if (!url.startsWith(`http://${host}:${port}/`)) throw new TypeError('Network request failed');
    const opened = openRemoteRequest(phones, String(init?.body), now);
    if (!opened) return new Response('forbidden', { status: 403 });
    received.push(opened.command);
    return new Response(opened.reply({ ok: true }), { status: 200 });
  }) as typeof fetch;
}

describe('remote play (D-061)', () => {
  beforeEach(() => resetTvSearch());

  it('a paired phone starts a title on the TV', async () => {
    const received: RemoteCommand[] = [];
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(tv.port, [phone], received), now: () => now })).resolves.toEqual({
      host: tv.host,
      port: tv.port,
    });
    expect(received).toEqual([command]);
  });

  it('a paired phone gets the TV log, sealed with its key (D-039)', async () => {
    let sealed = '';
    const logTv = (async (_url: string, init?: RequestInit) => {
      const opened = openRemoteRequest([phone], String(init?.body), now)!;
      expect(opened.command).toEqual({ type: 'log' });
      sealed = opened.reply({ ok: true, log: 'TV log · ×2' });
      return new Response(sealed, { status: 200 });
    }) as typeof fetch;
    await expect(sendRemoteCommand(tv, { type: 'log' }, { fetch: logTv, now: () => now })).resolves.toEqual({
      host: tv.host,
      port: tv.port,
      log: 'TV log · ×2',
    });
    expect(sealed).not.toContain('TV log');
  });

  it('finds the TV on another port of the range after a restart', async () => {
    const moved = REMOTE_PORTS[2]!;
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(moved, [phone]), now: () => now })).resolves.toEqual({
      host: tv.host,
      port: moved,
    });
  });

  it('refuses unknown phones, other keys and old (replayed) commands', async () => {
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(tv.port, []), now: () => now })).rejects.toMatchObject({
      reason: 'unknown-phone',
    });
    const otherKey = { ...phone, key: key(7) };
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(tv.port, [otherKey]), now: () => now })).rejects.toMatchObject({
      reason: 'unknown-phone',
    });
    const earlier = () => new Date(now.getTime() - 10 * 60_000);
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(tv.port, [phone]), now: earlier })).rejects.toMatchObject({
      reason: 'unknown-phone',
    });
    expect(openRemoteRequest([phone], 'not json', now)).toBeNull();
  });

  it('passes on the TV answer, and says when no TV answers', async () => {
    const busy = (async (_url: string, init?: RequestInit) => {
      const opened = openRemoteRequest([phone], String(init?.body), now)!;
      return new Response(opened.reply({ ok: false, error: 'no-profile' }), { status: 200 });
    }) as typeof fetch;
    await expect(sendRemoteCommand(tv, command, { fetch: busy, now: () => now })).rejects.toThrow(
      'Choose who is watching on Living room TV first.',
    );
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(1, [phone]), now: () => now })).rejects.toMatchObject({
      reason: 'unreachable',
    });
  });

  it('finds a TV that got a new address from the router on its home network, and only that TV (issue #268)', async () => {
    const asked: string[] = [];
    const received: RemoteCommand[] = [];
    const moved = fakeTv(tv.port, [phone], received, '192.168.1.57');
    // Another home's TV on the network answers 403: not this one.
    const network = (async (url: string, init?: RequestInit) => {
      asked.push(new URL(url).hostname);
      if (url.startsWith('http://192.168.1.21:')) return new Response('forbidden', { status: 403 });
      return moved(url, init);
    }) as typeof fetch;
    await expect(sendRemoteCommand(tv, command, { fetch: network, now: () => now })).resolves.toEqual({
      host: '192.168.1.57',
      port: tv.port,
    });
    expect(received).toEqual([command]);
    expect(asked).not.toContain('192.168.2.57');
    // Nearest addresses first.
    expect(asked.slice(REMOTE_PORTS.length, REMOTE_PORTS.length + 2)).toEqual(['192.168.1.19', '192.168.1.21']);
  });

  it('searches again only after a while when no TV answers, and never outside a home network', async () => {
    let asked = 0;
    const nobody = (async () => {
      asked++;
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await expect(sendRemoteCommand(tv, command, { fetch: nobody, now: () => now })).rejects.toMatchObject({ reason: 'unreachable' });
    expect(asked).toBe(REMOTE_PORTS.length + 253);
    asked = 0;
    await expect(sendRemoteCommand(tv, command, { fetch: nobody, now: () => now })).rejects.toMatchObject({ reason: 'unreachable' });
    expect(asked).toBe(REMOTE_PORTS.length);
    const later = () => new Date(now.getTime() + 31 * 60_000);
    asked = 0;
    await expect(sendRemoteCommand(tv, command, { fetch: nobody, now: later })).rejects.toMatchObject({ reason: 'unreachable' });
    expect(asked).toBeGreaterThan(REMOTE_PORTS.length);

    expect(neighbourHosts('8.8.8.8')).toEqual([]);
    expect(neighbourHosts('tv.local')).toEqual([]);
    expect(neighbourHosts('10.0.0.1').slice(0, 3)).toEqual(['10.0.0.2', '10.0.0.3', '10.0.0.4']);
    expect(neighbourHosts('172.16.5.254')).toHaveLength(253);
  });
});
