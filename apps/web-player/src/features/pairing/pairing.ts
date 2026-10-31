import { useEffect } from 'react';
import {
  appLog,
  AUTO_SYNC_INTERVAL_MS,
  createAutoSync,
  errorMessage,
  PairingFailure,
  parsePairingQr,
  sendPairing,
  syncWithTv,
  t,
  usePairingServer as usePairing,
  type PairedTv,
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
export const usePairingServer = () => usePairing(desktop?.pairing ?? null, { storages, reload: () => appContext.reload() });

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
    // A TV hands out its remote key: this computer then stays in step with it (issue #227).
    if (result.remote) await savePairedTv({ ...result.remote, host: offer.host, pairedAt: new Date().toISOString() });
    await appContext.reload();
    return result.mode === 'share'
      ? `${t('Signed in as {accountName}.', { accountName: result.accountName })} ${t('Both devices now have the same profiles, My List and progress.')}`
      : t('Both devices now have the same profiles, My List and progress.');
  } catch (error) {
    appLog.warn('pairing', errorMessage(error));
    throw error instanceof PairingFailure ? error : new Error(t('Something went wrong. Try again.'));
  }
}

/** The TV this computer scanned, as the phone app keeps it (D-061); in the secure storage, outside backups. */
const PAIRED_TV_KEY = 'remote.tv';
const readPairedTv = async (): Promise<PairedTv | null> => {
  try {
    return JSON.parse((await backupStorages.secure.getItem(PAIRED_TV_KEY)) ?? 'null') as PairedTv | null;
  } catch {
    return null;
  }
};
const savePairedTv = (tv: PairedTv) => backupStorages.secure.setItem(PAIRED_TV_KEY, JSON.stringify(tv));

const autoSync = createAutoSync(async () => {
  const tv = await readPairedTv();
  const accountId = stores.session.getState().account?.id;
  if (!tv || !accountId) return;
  const { host, port, changed, signIn } = await syncWithTv(storages, tv, accountId, { fetch: desktopFetch });
  // Another port, or a new address from the router (issue #268): the next sync goes there.
  if (host !== tv.host || port !== tv.port) await savePairedTv({ ...tv, host, port });
  appLog.info('sync', changed ? 'synced with the TV' : 'in step with the TV');
  // A new provider server, username or password from the TV (DECISIONS.md#d-228).
  if (signIn) await appContext.reload();
  else if (changed) await appContext.refreshMedia();
});

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
