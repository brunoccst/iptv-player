import { useEffect, useState } from 'react';
import { acceptPairing, appLog, errorMessage, pairingMessage, pairingQrText } from '@iptv/shared';
import { appContext, backupStorages } from '../../appContext';
import { desktop } from '../../desktop';

/** Sign-in and media data only; settings stay on each device (D-060). */
const storages = { secure: backupStorages.secure, data: backupStorages.data };

export type PairingServerState =
  | { phase: 'starting' }
  | { phase: 'ready'; qr: string; error: string | null }
  | { phase: 'working'; qr: string }
  | { phase: 'done'; mode: 'login' | 'sync'; accountName: string }
  | { phase: 'offline' };

/**
 * Desktop app, computer side of phone pairing (D-072, protocol D-060): while mounted, the app's pairing server runs
 * and `qr` holds the code. A phone that scans it signs this computer in or merges its data; the app state reloads.
 * Refused attempts (another account) keep the code valid. Not available in a browser.
 */
export function usePairingServer(): PairingServerState {
  const [state, setState] = useState<PairingServerState>({ phase: 'starting' });
  useEffect(() => {
    const pairing = desktop?.pairing;
    if (!pairing) {
      setState({ phase: 'offline' });
      return;
    }
    let active = true;
    let finished = false;
    let unsubscribe = () => {};
    void (async () => {
      let offer: Awaited<ReturnType<typeof pairing.start>>;
      try {
        offer = await pairing.start();
      } catch (error) {
        appLog.warn('pairing', `server did not start: ${errorMessage(error)}`);
        if (active) setState({ phase: 'offline' });
        return;
      }
      if (!active) return void pairing.stop();
      if (!offer.host) {
        void pairing.stop();
        return setState({ phase: 'offline' });
      }
      const qr = pairingQrText({ host: offer.host, port: offer.port, key: offer.key });
      setState({ phase: 'ready', qr, error: null });
      unsubscribe = pairing.onRequest(({ id, body }) => {
        void (async () => {
          if (finished) return pairing.respond(id, 410, '');
          try {
            setState({ phase: 'working', qr });
            const reply = await acceptPairing(storages, offer.key, body);
            const result = reply.result;
            if (result?.ok) finished = true;
            await pairing.respond(id, reply.status, reply.body);
            if (!result) {
              appLog.warn('pairing', 'request with a wrong key ignored');
              setState({ phase: 'ready', qr, error: null });
            } else if (!result.ok) {
              appLog.warn('pairing', `refused: ${result.error}`);
              setState({ phase: 'ready', qr, error: pairingMessage(result.error) });
            } else {
              appLog.info('pairing', `${result.mode === 'login' ? 'signed in' : 'synced'} with a phone`);
              void pairing.stop();
              await appContext.reload();
              setState({ phase: 'done', mode: result.mode, accountName: result.accountName });
            }
          } catch (error) {
            void pairing.respond(id, 500, '');
            appLog.warn('pairing', errorMessage(error));
            setState({ phase: 'ready', qr, error: 'Something went wrong. Scan the code again.' });
          }
        })();
      });
    })();
    return () => {
      active = false;
      unsubscribe();
      void pairing.stop();
    };
  }, []);
  return state;
}
