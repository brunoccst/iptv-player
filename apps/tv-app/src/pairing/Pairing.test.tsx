import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { acceptPairing, createMemoryStorage, pairingQrText, sendPairing } from '@iptv/shared';
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
/** A phone app signed in to `accountId` ("My server" mode, so the fake backend serves both devices). */
const phoneStorages = (accountId = account.id) => ({
  secure: createMemoryStorage({
    session: JSON.stringify({ token: 'phone-token', account: { ...account, id: accountId }, profiles: [profile], activeProfileId: 'p1' }),
    connection: JSON.stringify({ mode: 'server', serverUrl: 'http://api.test' }),
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

  it('TV account menu → Sync with phone: refuses another account, then syncs the same one', async () => {
    setupApp();
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
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
    expect(await screen.findByText('Synced with the phone.')).toBeTruthy();
    // The TV keeps its own sign-in.
    expect(stores.session.getState()).toMatchObject({ token: 'tok', activeProfileId: 'p1' });
    await fireEvent.press(screen.getByTestId('sync-with-phone-close'));
    expect(nativeState.pairingRunning).toBe(false);
  });

  it('phone account menu → Connect a TV scans the code and signs the TV in, without the playback settings', async () => {
    const backend = setupApp();
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    const tv = { secure: createMemoryStorage(), data: createMemoryStorage() };
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (!String(url).startsWith('http://192.168.1.20:38123/')) return backend.fetch(url, init);
      const reply = await acceptPairing(tv, PAIRING_KEY, String(init?.body));
      return new Response(reply.body, { status: reply.status });
    }) as typeof fetch;
    await SecureStore.setItemAsync('settings.playback', '{"audioDecoder":"ffmpeg"}');
    nativeState.scanResult = pairingQrText(offer);

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    expect(screen.getByText('Connect a TV')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('menu-pairing'));
    expect(await screen.findByText(/The TV is signed in with your account/)).toBeTruthy();
    expect(JSON.parse(tv.secure.data.get('session')!)).toMatchObject({ token: 'tok', activeProfileId: null });
    expect(JSON.stringify([...tv.secure.data, ...tv.data.data])).not.toContain('audioDecoder');
  });

  it('phone: a code from something else is explained', async () => {
    setupApp();
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    nativeState.scanResult = 'https://example.com';
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-pairing'));
    expect(await screen.findByText(/not a TV code from this app/)).toBeTruthy();
  });
});
