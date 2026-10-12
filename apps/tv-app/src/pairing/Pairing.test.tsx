import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  acceptPairing,
  appLog,
  createMemoryStorage,
  openRemoteRequest,
  pairingQrText,
  sendPairing,
  sendRemoteCommand,
  type PairedTv,
  type RemoteOffer,
} from '@iptv/shared';
import { Alert, Share } from 'react-native';
import { navStore } from '../appContext';
import { PlayOnTvButton } from '../components/PlayOnTvButton';
import { LogScreen } from '../screens/LogScreen';
import { pairedTv } from './remote';
import { App } from '../App';
import { stores } from '../appContext';
import { account, profile, setupApp } from '../../test/utils';
import { nativeState, PAIRING_KEY } from '../../test/tvMediaMock';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const offer = { host: '192.168.1.20', port: 38123, key: PAIRING_KEY };
/** A phone app signed in to `accountId`; the fake data serves both devices. */
const phoneStorages = (accountId = account.id) => ({
  secure: createMemoryStorage({
    session: JSON.stringify({ token: 'phone-token', account: { ...account, id: accountId }, profiles: [profile], activeProfileId: 'p1' }),
  }),
  data: createMemoryStorage({ 'settings.playback': '{"audioDecoder":"ffmpeg"}' }),
});
/** The phone's request goes to the TV's (mocked) pairing server. */
const toTv = (async (_url: string, init?: RequestInit) => {
  const reply = await nativeState.pairingRequest(String(init?.body));
  return new Response(reply.body, { status: reply.status });
}) as typeof fetch;

describe('phone-to-TV pairing (D-060)', () => {
  // TV tests; the phone tests switch to a phone.
  beforeEach(() => jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true));
  afterEach(() => jest.restoreAllMocks());

  it('TV sign-in page: a phone that scans the code signs the TV in, then the TV asks who is watching', async () => {
    setupApp({ signedIn: false });
    await render(<App />);
    await flush();
    expect(screen.getByTestId('pairing-qr')).toBeTruthy();
    expect(nativeState.pairingRunning).toBe(true);

    let result: unknown;
    await act(async () => {
      result = await sendPairing(phoneStorages(), offer, { fetch: toTv });
    });
    await flush();
    expect(result).toMatchObject({ ok: true, mode: 'login' });
    expect(stores.session.getState()).toMatchObject({ status: 'authenticated', token: 'phone-token', activeProfileId: null });
    expect(await screen.findByTestId('profiles-manage')).toBeTruthy();
    expect(nativeState.pairingRunning).toBe(false);
    expect(await SecureStore.getItemAsync('settings.playback')).toBeNull();
  });

  it('TV account menu → Sync with another device: refuses another account, then syncs the same one', async () => {
    setupApp();
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-library'));
    await fireEvent.press(screen.getByTestId('menu-pairing'));
    expect(screen.getByTestId('pairing-qr')).toBeTruthy();

    await act(async () => {
      await expect(sendPairing(phoneStorages('acc-other'), offer, { fetch: toTv })).rejects.toMatchObject({ reason: 'other-account' });
    });
    expect(screen.getByText(/signed in to a different account/)).toBeTruthy();

    await act(async () => {
      await sendPairing(phoneStorages(), offer, { fetch: toTv });
    });
    await flush();
    expect(await screen.findByText('Synced with the other device.')).toBeTruthy();
    // The TV keeps its own sign-in.
    expect(stores.session.getState()).toMatchObject({ token: 'tok', activeProfileId: 'p1' });
    await fireEvent.press(screen.getByTestId('sync-close'));
    expect(nativeState.pairingRunning).toBe(false);
  });

  it('phone account menu → Sync with another device → Scan a code and signs the TV in, without the playback settings', async () => {
    const backend = setupApp();
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    const tv = { secure: createMemoryStorage(), data: createMemoryStorage() };
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (!String(url).startsWith('http://192.168.1.20:38123/')) return backend.fetch(url, init);
      const remote = { tvId: 't', tvName: 'Living room TV', phoneId: 'p1', key: PAIRING_KEY, port: 38127 };
      const reply = await acceptPairing(tv, PAIRING_KEY, String(init?.body), { remote });
      return new Response(reply.body, { status: reply.status });
    }) as typeof fetch;
    await SecureStore.setItemAsync('settings.playback', '{"audioDecoder":"ffmpeg"}');
    nativeState.scanResult = pairingQrText(offer);

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-library'));
    expect(screen.getByText('Sync with another device')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('menu-pairing'));
    expect(screen.getByTestId('pairing-qr')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sync-scan'));
    expect(await screen.findByText(/The other device is signed in with your account/)).toBeTruthy();
    // Scanning stops this phone's own code.
    expect(nativeState.pairingRunning).toBe(false);
    expect(JSON.parse(tv.secure.data.get('session')!)).toMatchObject({ token: 'tok', activeProfileId: null });
    expect(JSON.stringify([...tv.secure.data, ...tv.data.data])).not.toContain('audioDecoder');
    // The phone keeps the TV for "Play on TV" (D-061).
    expect(pairedTv.getState().tv).toMatchObject({ host: '192.168.1.20', port: 38127, tvName: 'Living room TV' });
    expect(JSON.parse((await SecureStore.getItemAsync('remote.tv'))!)).toMatchObject({ host: '192.168.1.20' });
  });

  it('phone: a code from something else is explained', async () => {
    setupApp();
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    nativeState.scanResult = 'https://example.com';
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-library'));
    await fireEvent.press(screen.getByTestId('menu-pairing'));
    await fireEvent.press(screen.getByTestId('sync-scan'));
    expect(await screen.findByText(/not a code from this app/)).toBeTruthy();
  });

  it('phone account menu shows its own code: another phone or tablet that scans it syncs, without a remote-play key (D-178)', async () => {
    setupApp();
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-library'));
    await fireEvent.press(screen.getByTestId('menu-pairing'));
    expect(nativeState.pairingRunning).toBe(true);

    let result: unknown;
    await act(async () => {
      result = await sendPairing(phoneStorages(), offer, { fetch: toTv });
    });
    await flush();
    expect(result).toMatchObject({ ok: true, mode: 'sync', remote: undefined });
    expect(await screen.findByText('Synced with the other device.')).toBeTruthy();
    expect(screen.queryByTestId('sync-scan')).toBeNull();
  });

  it('phone sign-in page: shows its code, and Scan a code signs in with a signed-in device (D-178)', async () => {
    const backend = setupApp({ signedIn: false });
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    const tablet = phoneStorages();
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (!String(url).startsWith('http://192.168.1.20:38123/')) return backend.fetch(url, init);
      const reply = await acceptPairing(tablet, PAIRING_KEY, String(init?.body));
      return new Response(reply.body, { status: reply.status });
    }) as typeof fetch;
    nativeState.scanResult = pairingQrText(offer);

    await render(<App />);
    await flush();
    expect(screen.getByTestId('pairing-qr')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('login-scan'));
    expect(await screen.findByText(/Signed in as demo\./)).toBeTruthy();
    await flush();
    expect(stores.session.getState()).toMatchObject({ status: 'authenticated', token: 'phone-token', activeProfileId: null });
  });

  it('devices without a camera only show their code', async () => {
    setupApp({ signedIn: false });
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    nativeState.hasCamera = false;
    await render(<App />);
    await flush();
    expect(screen.getByTestId('pairing-qr')).toBeTruthy();
    expect(screen.queryByTestId('login-scan')).toBeNull();
  });

  describe('play on TV (D-061)', () => {
    const movie = { kind: 'movie' as const, streamId: '55', container: 'mkv', title: 'Big Movie' };
    const toRemote = (async (_url: string, init?: RequestInit) => {
      const reply = await nativeState.remoteRequest(String(init?.body));
      return new Response(reply.body, { status: reply.status });
    }) as typeof fetch;

    it('the TV plays what a paired phone sends, and refuses other accounts and unknown phones', async () => {
      setupApp();
      await render(<App />);
      await flush();
      expect(nativeState.remoteRunning).toBe(true);
      await fireEvent.press(screen.getByTestId('nav-account'));
      await fireEvent.press(screen.getByTestId('menu-group-library'));
      await fireEvent.press(screen.getByTestId('menu-pairing'));
      let remote: RemoteOffer | undefined;
      await act(async () => {
        remote = (await sendPairing(phoneStorages(), offer, { fetch: toTv })).remote;
      });
      await flush();
      expect(remote).toMatchObject({ tvName: 'Living room TV', port: 38127 });
      await fireEvent.press(screen.getByTestId('sync-close'));
      const tv: PairedTv = { ...remote!, host: '192.168.1.20', pairedAt: '2026-09-26T12:00:00Z' };

      await act(async () => {
        await sendRemoteCommand(tv, { type: 'play', accountId: account.id, target: movie }, { fetch: toRemote });
      });
      await flush();
      expect(navStore.getState().stack.at(-1)).toEqual({ name: 'player', target: movie });

      await act(async () => {
        await expect(
          sendRemoteCommand(tv, { type: 'play', accountId: 'acc-other', target: movie }, { fetch: toRemote }),
        ).rejects.toMatchObject({ reason: 'other-account' });
        await expect(
          sendRemoteCommand({ ...tv, phoneId: 'stranger' }, { type: 'play', accountId: account.id, target: movie }, { fetch: toRemote }),
        ).rejects.toMatchObject({ reason: 'unknown-phone' });
      });

      // D-039: the phone can fetch the TV log; the provider's address and the account stay masked.
      appLog.error('player', 'attempt 1 failed: http://portal.example.com:8080/movie/bob/pw/55.mkv from 192.168.1.5');
      let log: string | undefined;
      await act(async () => {
        log = (await sendRemoteCommand(tv, { type: 'log' }, { fetch: toRemote })).log;
      });
      expect(log).toContain('diagnostics log (TV)');
      expect(log).toContain('attempt 1 failed: http://***/movie/***/***/55.mkv from ***');
      expect(log).not.toMatch(/portal\.example|bob|192\.168\.1\.5/);
    });

    it('phones with a paired TV show "Play on TV"; it sends the title', async () => {
      setupApp();
      stores.session.setState({ account: { ...account } });
      jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const key = PAIRING_KEY;
      const tv: PairedTv = { tvId: 't', tvName: 'Living room TV', phoneId: 'p1', key, port: 38127, host: '192.168.1.20', pairedAt: 'x' };
      const received: unknown[] = [];
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        const opened = openRemoteRequest([{ phoneId: 'p1', key, pairedAt: 'x' }], String(init?.body))!;
        received.push(opened.command);
        return new Response(opened.reply({ ok: true }), { status: 200 });
      }) as typeof fetch;

      const view = await render(<PlayOnTvButton target={movie} testID="tv-button" />);
      expect(screen.queryByTestId('tv-button')).toBeNull();
      await act(async () => pairedTv.setState({ tv }));
      await fireEvent.press(screen.getByLabelText('Play Big Movie on Living room TV'));
      await flush();
      expect(received).toEqual([{ type: 'play', accountId: account.id, target: movie }]);
      expect(alert).toHaveBeenCalledWith('Play on TV', 'Playing on Living room TV.');
      await view.unmount();
    });

    it('phones with a paired TV get its log on the Log page and share it (D-039)', async () => {
      setupApp();
      jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
      const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
      const key = PAIRING_KEY;
      const tv: PairedTv = { tvId: 't', tvName: 'Living room TV', phoneId: 'p1', key, port: 38127, host: '192.168.1.20', pairedAt: 'x' };
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        const opened = openRemoteRequest([{ phoneId: 'p1', key, pairedAt: 'x' }], String(init?.body))!;
        expect(opened.command).toEqual({ type: 'log' });
        return new Response(opened.reply({ ok: true, log: 'the TV log' }), { status: 200 });
      }) as typeof fetch;

      await act(async () => pairedTv.setState({ tv: null }));
      const view = await render(<LogScreen />);
      expect(screen.queryByTestId('log-get-tv')).toBeNull();
      await act(async () => pairedTv.setState({ tv }));
      await fireEvent.press(screen.getByTestId('log-get-tv'));
      await flush();
      expect(share).toHaveBeenCalledWith({ title: 'Test TV log (Living room TV)', message: 'the TV log' });
      await view.unmount();
    });
  });
});
