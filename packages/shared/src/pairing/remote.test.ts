import { describe, expect, it } from 'vitest';
import { openRemoteRequest, REMOTE_PORTS, sendRemoteCommand, type PairedPhone, type PairedTv, type RemoteCommand } from './remote';

const key = (seed: number) => btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => (i * seed) % 256)));
const phone: PairedPhone = { phoneId: 'phone-1', key: key(3), pairedAt: '2026-09-26T10:00:00Z' };
const tv: PairedTv = { ...phone, tvId: 'tv-1', tvName: 'Living room TV', host: '192.168.1.20', port: REMOTE_PORTS[0]! };
const command: RemoteCommand = {
  type: 'play',
  accountId: 'acc-1',
  target: { kind: 'movie', streamId: '55', container: 'mkv', title: 'Big Movie' },
};
const now = new Date('2026-09-26T12:00:00Z');

/** A TV on `port` that plays whatever a paired phone sends. */
function fakeTv(port: number, phones: PairedPhone[], received: RemoteCommand[] = []) {
  return (async (url: string, init?: RequestInit) => {
    if (!url.startsWith(`http://192.168.1.20:${port}/`)) throw new TypeError('Network request failed');
    const opened = openRemoteRequest(phones, String(init?.body), now);
    if (!opened) return new Response('forbidden', { status: 403 });
    received.push(opened.command);
    return new Response(opened.reply({ ok: true }), { status: 200 });
  }) as typeof fetch;
}

describe('remote play (D-061)', () => {
  it('a paired phone starts a title on the TV', async () => {
    const received: RemoteCommand[] = [];
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(tv.port, [phone], received), now: () => now })).resolves.toEqual({
      port: tv.port,
    });
    expect(received).toEqual([command]);
  });

  it('finds the TV on another port of the range after a restart', async () => {
    const moved = REMOTE_PORTS[2]!;
    await expect(sendRemoteCommand(tv, command, { fetch: fakeTv(moved, [phone]), now: () => now })).resolves.toEqual({ port: moved });
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
});
