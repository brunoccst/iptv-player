import {
  type PairingServer,
  usePairingServer as usePairing,
  appLog,
  errorMessage,
  parsePairingQr,
  PairingFailure,
  sendPairing,
  t,
} from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { appContext, backupStorages } from '../appContext';
import { pairedTv, rememberPhone, remoteOffer } from './remote';

/** Sign-in and media data only: device settings (the audio decoder, D-059) stay on each device (D-060). */
const storages = { secure: backupStorages.secure, data: backupStorages.data };

export type { PairingServerState } from '@iptv/shared';

/** The pairing server of the native module. */
const server: PairingServer = {
  start: () => TvMedia.startPairing(),
  stop: () => TvMedia.stopPairing(),
  respond: (id, status, body) => TvMedia.respondPairing(String(id), status, body),
  onRequest: (listener) => {
    const subscription = TvMedia.addListener('onPairingRequest', listener);
    return () => subscription.remove();
  },
};

/**
 * TV side (D-060), the shared hook (D-124): while mounted, the pairing server runs and `qr` holds the code to show.
 * The phone also gets a key for remote play (D-061), kept here once pairing succeeded.
 */
export const usePairingServer = () =>
  usePairing(server, {
    storages,
    reload: () => appContext.reload(),
    remoteOffer,
    paired: async (remote) => {
      if (remote) await rememberPhone(remote);
    },
  });

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
      t(
        'This is not a code from this app. On the TV or computer, open the QR code on the sign-in page or in the account menu → Sync with phone.',
      ),
    );
  try {
    const result = await sendPairing(storages, offer);
    appLog.info('pairing', `${result.mode === 'login' ? 'signed in' : 'synced'} a TV`);
    if (result.remote) await pairedTv.getState().save({ ...result.remote, host: offer.host, pairedAt: new Date().toISOString() });
    await appContext.reload();
    const done =
      result.mode === 'login'
        ? t(
            'The TV or computer is signed in with your account. Pick a profile there. Both devices now have the same profiles, My List and progress.',
          )
        : t('Both devices now have the same profiles, My List and progress.');
    return result.remote ? `${done} ${t('Use "Play on TV" on a title to start it on the TV.')}` : done;
  } catch (error) {
    appLog.warn('pairing', errorMessage(error));
    throw error instanceof PairingFailure ? error : new Error(t('Something went wrong. Try again.'));
  }
}
