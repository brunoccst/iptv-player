import { appLog, errorMessage, PairingFailure, parsePairingQr, sendPairing, t, usePairingServer as usePairing } from '@iptv/shared';
import { appContext, backupStorages } from '../../appContext';
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
  const answer = await desktop!.pairing.send!(url.hostname, Number(url.port), String(init?.body ?? ''));
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
    await appContext.reload();
    return result.mode === 'share'
      ? `${t('Signed in as {accountName}.', { accountName: result.accountName })} ${t('Both devices now have the same profiles, My List and progress.')}`
      : t('Both devices now have the same profiles, My List and progress.');
  } catch (error) {
    appLog.warn('pairing', errorMessage(error));
    throw error instanceof PairingFailure ? error : new Error(t('Something went wrong. Try again.'));
  }
}
