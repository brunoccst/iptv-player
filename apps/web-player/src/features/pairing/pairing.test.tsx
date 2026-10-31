// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptPairing,
  createMemoryStorage,
  pairingQrText,
  parsePairingQr,
  sendPairing,
  SESSION_STORAGE_KEY,
  syncWithTv,
} from '@iptv/shared';

// The desktop app's bridge (apps/desktop/preload.cjs): the phone's request arrives through `onRequest`.
const bridge = vi.hoisted(() => {
  let listener: ((request: { id: number; body: string }) => void) | null = null;
  let remoteListener: ((request: { id: number; body: string }) => void) | null = null;
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
      /** The computer scanned a phone's code (issue #254): the main process sends to it; the test answers as the phone. */
      send: async (host: string, port: number, body: string) => {
        bridge.sent.push(`${host}:${port}`);
        return bridge.answerScan(body);
      },
    },
    /** The computer's sync server (issue #268): requests from the phone's fetch go to the page. */
    remote: {
      start: async () => ({ port: 38127, name: 'Desk PC' }),
      stop: async () => undefined,
      respond: async (id: number, status: number, body: string) => answers.get(id)?.({ status, body }),
      onRequest(next: (request: { id: number; body: string }) => void) {
        remoteListener = next;
        return () => (remoteListener = null);
      },
    },
    remoteFetch: (async (url: string, init?: RequestInit) => {
      if (!String(url).startsWith('http://192.168.1.23:38127/remote')) throw new TypeError('Network request failed');
      const id = nextId++;
      const reply = await new Promise<{ status: number; body: string }>((resolve) => {
        answers.set(id, resolve);
        remoteListener?.({ id, body: String(init?.body) });
      });
      return new Response(reply.body, { status: reply.status });
    }) as typeof fetch,
    sent: [] as string[],
    answerScan: async (_body: string): Promise<{ status: number; body: string }> => ({ status: 404, body: '' }),
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
const computer = vi.hoisted(() => ({ secure: new Map<string, string>(), data: new Map<string, string>(), reloads: 0, refreshes: 0 }));

vi.mock('../../desktop', () => ({ desktop: { pairing: bridge.pairing, remote: bridge.remote } }));
vi.mock('../../appContext', () => {
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  });
  return {
    appContext: { reload: async () => void computer.reloads++, refreshMedia: async () => void computer.refreshes++ },
    backupStorages: { secure: storage(computer.secure), data: storage(computer.data) },
  };
});

const { connectWithScannedCode, usePairingServer, useRemoteServer } = await import('./pairing');

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

describe('desktop: sign in and sync with the phone app (D-060)', () => {
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

  it('a phone that scans the code gets a key, then syncs with the computer on its own, the TV not needed (issue #268)', async () => {
    computer.secure.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: 't', account, profiles: [{ id: 'p1', name: 'Ana' }], activeProfileId: 'p1' }),
    );
    const server = renderHook(() => useRemoteServer(true));
    const { result } = renderHook(() => usePairingServer());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const qr = (result.current as { qr: string }).qr;
    const device = phone();
    let reply: Awaited<ReturnType<typeof sendPairing>> | undefined;
    await act(async () => {
      reply = await sendPairing(device, parsePairingQr(qr)!, { fetch: bridge.phoneFetch });
    });
    expect(reply).toMatchObject({ ok: true, remote: { kind: 'computer', tvName: 'Desk PC', port: 38127 } });
    expect(JSON.parse(computer.secure.get('remote.phones')!)).toHaveLength(1);

    // Later the phone syncs with the computer, through its sync server.
    const paired = { ...reply!.remote!, host: '192.168.1.23', pairedAt: '2026-10-31T10:00:00Z' };
    let synced: Awaited<ReturnType<typeof syncWithTv>> | undefined;
    await act(async () => {
      synced = await syncWithTv(device, paired, account.id, { fetch: bridge.remoteFetch });
    });
    expect(synced).toMatchObject({ host: '192.168.1.23', port: 38127 });
    // An unknown phone is refused.
    const stranger = { ...paired, phoneId: 'nobody' };
    await act(async () => {
      await expect(syncWithTv(device, stranger, account.id, { fetch: bridge.remoteFetch })).rejects.toMatchObject({
        reason: 'unknown-phone',
      });
    });
    server.unmount();
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

describe("desktop: scanning another device's code with the webcam (issue #254)", () => {
  it("a signed-out computer gets the phone's sign-in through the main process", async () => {
    const mobile = phone();
    const key = 'k'.repeat(43) + '=';
    bridge.answerScan = async (body) => {
      const { status, body: answer } = await acceptPairing(mobile, key, body);
      return { status, body: answer };
    };
    const message = await connectWithScannedCode(pairingQrText({ host: '192.168.1.40', port: 41000, key }));

    expect(bridge.sent).toEqual(['192.168.1.40:41000']);
    expect(message).toMatch(/^Signed in as demo\./);
    expect(JSON.parse(computer.secure.get(SESSION_STORAGE_KEY)!)).toMatchObject({ token: 't', account });
    expect(computer.reloads).toBe(1);
  });

  it('says so when the code is not from this app', async () => {
    await expect(connectWithScannedCode('https://example.com')).rejects.toThrow(/not a code from this app/);
  });
});
