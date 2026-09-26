// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, parsePairingQr, sendPairing, SESSION_STORAGE_KEY } from '@iptv/shared';

// The desktop app's bridge (apps/desktop/preload.cjs): the phone's request arrives through `onRequest`.
const bridge = vi.hoisted(() => {
  let listener: ((request: { id: number; body: string }) => void) | null = null;
  const answers = new Map<number, (reply: { status: number; body: string }) => void>();
  let nextId = 1;
  return {
    started: 0,
    stopped: 0,
    host: '192.168.1.23' as string | null,
    pairing: {
      start: async () => {
        bridge.started++;
        return { host: bridge.host, port: 40123, key: 'q'.repeat(43) + '=' };
      },
      stop: async () => void bridge.stopped++,
      respond: async (id: number, status: number, body: string) => answers.get(id)?.({ status, body }),
      onRequest(next: (request: { id: number; body: string }) => void) {
        listener = next;
        return () => (listener = null);
      },
    },
    /** What the phone's fetch reaches: the computer's pairing server. */
    phoneFetch: (async (_url: string, init?: RequestInit) => {
      const id = nextId++;
      const reply = await new Promise<{ status: number; body: string }>((resolve) => {
        answers.set(id, resolve);
        listener?.({ id, body: String(init?.body) });
      });
      return new Response(reply.body, { status: reply.status });
    }) as typeof fetch,
  };
});
const computer = vi.hoisted(() => ({ secure: new Map<string, string>(), data: new Map<string, string>(), reloads: 0 }));

vi.mock('../../desktop', () => ({ desktop: { pairing: bridge.pairing } }));
vi.mock('../../appContext', () => {
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  });
  return {
    appContext: { reload: async () => void computer.reloads++ },
    backupStorages: { secure: storage(computer.secure), data: storage(computer.data) },
  };
});

const { usePairingServer } = await import('./pairing');

const account = { id: 'acc-1', username: 'demo' };
const phone = () => ({
  secure: createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 't', account, profiles: [{ id: 'p1', name: 'Ana' }], activeProfileId: 'p1' }),
    connection: JSON.stringify({ mode: 'direct', serverUrl: '' }),
  }),
  data: createMemoryStorage(),
});

afterEach(() => {
  computer.secure.clear();
  computer.data.clear();
  computer.reloads = 0;
  bridge.host = '192.168.1.23';
});

describe('desktop: sign in and sync with the phone app (D-072)', () => {
  it('shows the code; a phone that scans it signs the computer in', async () => {
    const { result, unmount } = renderHook(() => usePairingServer());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const qr = (result.current as { qr: string }).qr;
    expect(qr).toMatch(/^IPTVPAIR:1:192\.168\.1\.23:40123:/);

    let reply: Awaited<ReturnType<typeof sendPairing>> | undefined;
    await act(async () => {
      reply = await sendPairing(phone(), parsePairingQr(qr)!, { fetch: bridge.phoneFetch });
    });
    expect(reply).toMatchObject({ ok: true, mode: 'login' });
    await waitFor(() => expect(result.current).toEqual({ phase: 'done', mode: 'login', accountName: 'demo' }));
    expect(JSON.parse(computer.secure.get(SESSION_STORAGE_KEY)!)).toMatchObject({ token: 't', account, activeProfileId: null });
    expect(computer.reloads).toBe(1);

    const stops = bridge.stopped;
    unmount();
    expect(bridge.stopped).toBe(stops + 1);
  });

  it('refuses a phone with another account and keeps the code; says so without a home network', async () => {
    computer.secure.set(SESSION_STORAGE_KEY, JSON.stringify({ token: 'x', account: { id: 'other' }, profiles: [] }));
    const { result } = renderHook(() => usePairingServer());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const qr = (result.current as { qr: string }).qr;
    await act(async () => {
      await expect(sendPairing(phone(), parsePairingQr(qr)!, { fetch: bridge.phoneFetch })).rejects.toThrow(/different account/);
    });
    expect(result.current).toMatchObject({ phase: 'ready', error: expect.stringMatching(/different account/) });

    bridge.host = null;
    const offline = renderHook(() => usePairingServer());
    await waitFor(() => expect(offline.result.current.phase).toBe('offline'));
  });
});
