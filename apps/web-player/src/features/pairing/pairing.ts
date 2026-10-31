import { useEffect } from 'react';
import {
  answerSync,
  appLog,
  AUTO_SYNC_INTERVAL_MS,
  createAutoSync,
  errorMessage,
  PairingFailure,
  parsePairingQr,
  sendPairing,
  openRemoteRequest,
  REMOTE_PORTS,
  syncWithTv,
  t,
  usePairingServer as usePairing,
  type PairedPhone,
  type PairedTv,
  type RemoteOffer,
} from '@iptv/shared';
import { appContext, backupStorages, stores } from '../../appContext';
import { desktop } from '../../desktop';

/** Sign-in and media data only; settings stay on each device (D-060). */
const storages = { secure: backupStorages.secure, data: backupStorages.data };

export type { PairingServerState } from '@iptv/shared';

/**
 * Desktop app, computer side of phone pairing (D-060): the shared hook (D-079) with the app's pairing
 * server in the main process. Not available in a browser.
 */
export const usePairingServer = () =>
  usePairing(
    desktop?.pairing ?? null,
    // A phone that scans this computer's code also gets a key to sync with it later (issue #268, DECISIONS.md#d-240).
    desktop?.remote
      ? {
          storages,
          reload: () => appContext.reload(),
          remoteOffer,
          paired: async (remote) => void (remote && (await rememberPhone(remote))),
        }
      : { storages, reload: () => appContext.reload() },
  );

/** Whether this computer can scan another device's code: the desktop app with a camera API (issue #254). */
export const canScanWithWebcam = () => !!desktop?.pairing.send && !!globalThis.navigator?.mediaDevices?.getUserMedia;

/** `fetch` for `sendPairing` through the main process: device servers send no CORS headers (issue #254). */
const desktopFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const path = url.pathname === '/remote' ? '/remote' : '/pair';
  const sending = desktop!.pairing.send!(url.hostname, Number(url.port), String(init?.body ?? ''), path);
  // The search for a TV that moved gives up on an address after a second (issue #268); the main process waits longer.
  const signal = init?.signal;
  const answer = signal
    ? await Promise.race([
        sending,
        new Promise<never>((_, reject) => {
          if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
      ])
    : await sending;
  return new Response(answer.body, { status: answer.status });
}) as typeof fetch;

/**
 * Pairs with the device whose QR code the webcam read (issue #254, D-178), as phones do: signed in, both devices end up
 * with the same profiles, My List and progress; signed out, this computer gets the other device's sign-in. Returns the
 * message to show; throws with a message for the user.
 */
export async function connectWithScannedCode(text: string): Promise<string> {
  const offer = parsePairingQr(text);
  if (!offer)
    throw new Error(
      t(
        'This is not a code from this app. On the other device, open the QR code on the sign-in page or in the account menu → Sync with another device.',
      ),
    );
  try {
    const result = await sendPairing(storages, offer, { fetch: desktopFetch });
    appLog.info('pairing', `${result.mode === 'share' ? 'got the sign-in of' : 'synced'} a device (webcam)`);
    // A TV, or another computer (issue #268), hands out its remote key: this computer then stays in step with it (issue #227).
    if (result.remote) await saveHub({ ...result.remote, host: offer.host, pairedAt: new Date().toISOString() });
    await appContext.reload();
    return result.mode === 'share'
      ? `${t('Signed in as {accountName}.', { accountName: result.accountName })} ${t('Both devices now have the same profiles, My List and progress.')}`
      : t('Both devices now have the same profiles, My List and progress.');
  } catch (error) {
    appLog.warn('pairing', errorMessage(error));
    throw error instanceof PairingFailure ? error : new Error(t('Something went wrong. Try again.'));
  }
}

/**
 * The TV this computer scanned, as the phone app keeps it (D-061), and another computer whose code it scanned (issue
 * #268); in the secure storage, outside backups.
 */
const HUB_KEYS = { tv: 'remote.tv', computer: 'remote.computer' } as const;
const readHub = async (kind: keyof typeof HUB_KEYS): Promise<PairedTv | null> => {
  try {
    return JSON.parse((await backupStorages.secure.getItem(HUB_KEYS[kind])) ?? 'null') as PairedTv | null;
  } catch {
    return null;
  }
};
const saveHub = (hub: PairedTv) => backupStorages.secure.setItem(HUB_KEYS[hub.kind ?? 'tv'], JSON.stringify(hub));

const autoSync = createAutoSync(async () => {
  const accountId = stores.session.getState().account?.id;
  if (!accountId) return;
  for (const hub of [await readHub('tv'), await readHub('computer')]) {
    if (!hub) continue;
    const { host, port, changed, signIn } = await syncWithTv(storages, hub, accountId, { fetch: desktopFetch });
    // Another port, or a new address from the router (issue #268): the next sync goes there.
    if (host !== hub.host || port !== hub.port) await saveHub({ ...hub, host, port });
    appLog.info('sync', `${changed ? 'synced with' : 'in step with'} the ${hub.kind === 'computer' ? 'computer' : 'TV'}`);
    // A new provider server, username or password from the TV (DECISIONS.md#d-228).
    if (signIn) return appContext.reload();
    if (changed) await appContext.refreshMedia();
  }
});

/** The phones that scanned this computer's code (issue #268), with their keys; the oldest drops out after five. */
const PAIRED_PHONES_KEY = 'remote.phones';
const HUB_ID_KEY = 'remote.tvId';
const MAX_PHONES = 5;
/** Where this computer's sync server listens, once started; its name for the phones' messages. */
let remoteServer: { port: number; name: string } | null = null;

const randomKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const shortId = () =>
  randomKey()
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 16);

async function readPhones(): Promise<PairedPhone[]> {
  try {
    return (JSON.parse((await backupStorages.secure.getItem(PAIRED_PHONES_KEY)) ?? '[]') as PairedPhone[]) ?? [];
  } catch {
    return [];
  }
}

/** The key a phone gets with the pairing answer, to sync with this computer from then on (issue #268). */
async function remoteOffer(): Promise<RemoteOffer | undefined> {
  if (!remoteServer) return undefined;
  let id = await backupStorages.secure.getItem(HUB_ID_KEY);
  if (!id) {
    id = shortId();
    await backupStorages.secure.setItem(HUB_ID_KEY, id);
  }
  return { tvId: id, tvName: remoteServer.name, phoneId: shortId(), key: randomKey(), port: remoteServer.port, kind: 'computer' };
}

async function rememberPhone(offer: RemoteOffer) {
  const phone: PairedPhone = { phoneId: offer.phoneId, key: offer.key, pairedAt: new Date().toISOString() };
  await backupStorages.secure.setItem(PAIRED_PHONES_KEY, JSON.stringify([...(await readPhones()), phone].slice(-MAX_PHONES)));
}

/** One request from a paired phone (issue #268): a sync is merged and answered, as the TV does; nothing else here. */
async function answerRemote(body: string): Promise<{ status: number; body: string }> {
  const opened = openRemoteRequest(await readPhones(), body);
  if (!opened) {
    appLog.warn('remote', 'request from an unknown phone ignored');
    return { status: 403, body: 'forbidden' };
  }
  const { command, reply } = opened;
  if (command.type !== 'sync') return { status: 200, body: reply({ ok: false, error: 'bad-request' }) };
  const { reply: answer, changed, signIn } = await answerSync(storages, command);
  appLog.info('sync', answer.ok ? (changed ? 'synced with a device' : 'in step with a device') : `sync refused: ${answer.error}`);
  // After answering: a reload or refresh would hold the phone's answer back.
  queueMicrotask(() => void (signIn ? appContext.reload() : changed ? appContext.refreshMedia() : undefined));
  return { status: 200, body: reply(answer) };
}

/**
 * Desktop app, while signed in: listens on the home network for the phones that scanned this computer's code, so they
 * sync with it like with the TV, with the TV off too and the window closed (issue #268, DECISIONS.md#d-240).
 */
export function useRemoteServer(signedIn: boolean) {
  useEffect(() => {
    const remote = desktop?.remote;
    if (!signedIn || !remote) return;
    let active = true;
    const unsubscribe = remote.onRequest(({ id, body }) => {
      void answerRemote(body)
        .catch((error: unknown) => {
          appLog.warn('remote', errorMessage(error));
          return { status: 500, body: '' };
        })
        .then((answer) => remote.respond(id, answer.status, answer.body));
    });
    remote
      .start()
      .then((started) => {
        if (!active) return;
        remoteServer = started;
        appLog.info('remote', `listening on port ${started.port}`);
      })
      .catch((error: unknown) => appLog.warn('remote', `server did not start: ${errorMessage(error)} (ports ${REMOTE_PORTS.join(', ')})`));
    return () => {
      active = false;
      unsubscribe();
      remoteServer = null;
      void remote.stop();
    };
  }, [signedIn]);
}

/**
 * Desktop app, while signed in: keeps profiles, progress and My List in step with the TV whose code this computer
 * scanned (issue #227, DECISIONS.md#d-186): when the app opens or its window comes back, and every 10 minutes.
 */
export function useAutoSync(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || !desktop?.pairing.send) return;
    void autoSync.request();
    const timer = setInterval(() => void autoSync.request(), AUTO_SYNC_INTERVAL_MS);
    const visible = () => {
      if (document.visibilityState === 'visible') void autoSync.request();
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', visible);
    };
  }, [signedIn]);
}
