import { useEffect, useState } from 'react';
import {
  acceptPairing,
  appLog,
  errorMessage,
  pairingMessage,
  pairingQrText,
  parsePairingQr,
  PairingFailure,
  sendPairing,
  type PairingResult,
} from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { appContext, backupStorages } from '../appContext';

/** Sign-in and media data only: device settings (the audio decoder, D-059) stay on each device (D-060). */
const storages = { secure: backupStorages.secure, data: backupStorages.data };

export type PairingServerState =
  | { phase: 'starting' }
  | { phase: 'ready'; qr: string; error: string | null }
  | { phase: 'working'; qr: string }
  | { phase: 'done'; mode: 'login' | 'sync'; accountName: string }
  | { phase: 'offline' };

/**
 * TV side (D-060): while mounted, the pairing server runs and `qr` holds the code to show. A phone that scans it signs
 * this TV in or merges its data; the app state is reloaded. Refused attempts (another account) keep the code valid.
 */
export function usePairingServer(): PairingServerState {
  const [state, setState] = useState<PairingServerState>({ phase: 'starting' });
  useEffect(() => {
    let offer: ReturnType<typeof TvMedia.startPairing>;
    try {
      offer = TvMedia.startPairing();
    } catch (error) {
      appLog.warn('pairing', `server did not start: ${errorMessage(error)}`);
      setState({ phase: 'offline' });
      return;
    }
    if (!offer.host) {
      TvMedia.stopPairing();
      setState({ phase: 'offline' });
      return;
    }
    const qr = pairingQrText({ host: offer.host, port: offer.port, key: offer.key });
    setState({ phase: 'ready', qr, error: null });
    let finished = false;
    const subscription = TvMedia.addListener('onPairingRequest', ({ id, body }) => {
      void (async () => {
        if (finished) return TvMedia.respondPairing(id, 410, '');
        try {
          setState({ phase: 'working', qr });
          const reply = await acceptPairing(storages, offer.key, body);
          const result: PairingResult | null = reply.result;
          if (result?.ok) finished = true;
          TvMedia.respondPairing(id, reply.status, reply.body);
          if (!result) {
            appLog.warn('pairing', 'request with a wrong key ignored');
            setState({ phase: 'ready', qr, error: null });
          } else if (!result.ok) {
            appLog.warn('pairing', `refused: ${result.error}`);
            setState({ phase: 'ready', qr, error: pairingMessage(result.error) });
          } else {
            appLog.info('pairing', `${result.mode === 'login' ? 'signed in' : 'synced'} with a phone`);
            TvMedia.stopPairing();
            await appContext.reload();
            setState({ phase: 'done', mode: result.mode, accountName: result.accountName });
          }
        } catch (error) {
          TvMedia.respondPairing(id, 500, '');
          appLog.warn('pairing', errorMessage(error));
          setState({ phase: 'ready', qr, error: 'Something went wrong. Scan the code again.' });
        }
      })();
    });
    return () => {
      subscription.remove();
      TvMedia.stopPairing();
    };
  }, []);
  return state;
}

/**
 * Phone side (D-060): scans the TV's QR code and pairs. Returns a message for the user, or null when the scan was
 * cancelled. Throws with a user-facing message.
 */
export async function connectToTv(): Promise<string | null> {
  const text = await TvMedia.scanQrCode();
  if (!text) return null;
  const offer = parsePairingQr(text);
  if (!offer)
    throw new Error(
      'This is not a TV code from this app. On the TV, open the QR code on the sign-in page or in the account menu → Sync with phone.',
    );
  try {
    const result = await sendPairing(storages, offer);
    appLog.info('pairing', `${result.mode === 'login' ? 'signed in' : 'synced'} a TV`);
    await appContext.reload();
    return result.mode === 'login'
      ? 'The TV is signed in with your account. Pick a profile on the TV. Phone and TV now have the same profiles, My List and progress.'
      : 'Phone and TV now have the same profiles, My List and progress.';
  } catch (error) {
    appLog.warn('pairing', errorMessage(error));
    throw error instanceof PairingFailure ? error : new Error('Something went wrong. Try again.');
  }
}
