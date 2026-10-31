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
import { Platform } from 'react-native';
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
 * Side showing the code (D-060, D-178), the shared hook (D-079): while mounted, the pairing server runs and `qr` holds
 * the code to show. TV: the other device also gets a key for remote play (D-061), kept here once pairing succeeded.
 */
export const usePairingServer = () =>
  usePairing(
    server,
    Platform.isTV
      ? {
          storages,
          reload: () => appContext.reload(),
          remoteOffer,
          paired: async (remote) => {
            if (remote) await rememberPhone(remote);
          },
        }
      : { storages, reload: () => appContext.reload() },
  );

/** Devices with a camera can scan another device's code (D-178). */
export const canScanQr = () => TvMedia.hasCamera();

/**
 * Scanning side (D-060, D-178): scans another device's QR code and pairs. Returns a message for the user, or null when
 * the scan was cancelled. Throws with a user-facing message.
 */
export async function connectToDevice(): Promise<string | null> {
  const text = await TvMedia.scanQrCode();
  if (!text) return null;
  const offer = parsePairingQr(text);
  if (!offer)
    throw new Error(
      t(
        'This is not a code from this app. On the other device, open the QR code on the sign-in page or in the account menu → Sync with another device.',
      ),
    );
  try {
    const result = await sendPairing(storages, offer);
    appLog.info('pairing', `${result.mode === 'login' ? 'signed in' : result.mode === 'share' ? 'got the sign-in of' : 'synced'} a device`);
    // A TV, or since 3.1 a computer (issue #268): this phone syncs with it on its own from then on.
    if (result.remote) await pairedTv.getState().save({ ...result.remote, host: offer.host, pairedAt: new Date().toISOString() });
    await appContext.reload();
    const done =
      result.mode === 'login'
        ? t(
            'The other device is signed in with your account. Pick a profile there. Both devices now have the same profiles, My List and progress.',
          )
        : result.mode === 'share'
          ? `${t('Signed in as {accountName}.', { accountName: result.accountName })} ${t('Both devices now have the same profiles, My List and progress.')}`
          : t('Both devices now have the same profiles, My List and progress.');
    return result.remote && result.remote.kind !== 'computer' ? `${done} ${t('Use "Play on TV" on a title to start it on the TV.')}` : done;
  } catch (error) {
    appLog.warn('pairing', errorMessage(error));
    throw error instanceof PairingFailure ? error : new Error(t('Something went wrong. Try again.'));
  }
}
