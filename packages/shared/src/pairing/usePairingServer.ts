import { useEffect, useState } from 'react';
import type { BackupStorages } from '../backup/userData';
import { t } from '../i18n/i18n';
import { appLog, errorMessage } from '../utils/logger';
import { acceptPairing, pairingMessage, pairingQrText } from './pairing';
import type { RemoteOffer } from './remote';

export type PairingServerState =
  | { phase: 'starting' }
  | { phase: 'ready'; qr: string; error: string | null }
  | { phase: 'working'; qr: string }
  | { phase: 'done'; mode: 'login' | 'sync'; accountName: string }
  | { phase: 'offline' };

/** The device's pairing server (TV: native module; desktop: the main process). */
export interface PairingServer {
  /** `host` is null without a home network. `key`: 32 random bytes, base64. */
  start(): { host: string | null; port: number; key: string } | Promise<{ host: string | null; port: number; key: string }>;
  stop(): void | Promise<void>;
  respond(id: number | string, status: number, body: string): void | Promise<void>;
  /** Returns the unsubscribe function. */
  onRequest(listener: (request: { id: number | string; body: string }) => void): () => void;
}

/**
 * The TV's or computer's side of phone pairing (D-060, D-072), for both apps (D-124): while mounted, the server runs
 * and `qr` holds the code to show. A phone that scans it signs this device in or merges its data, then the app state
 * reloads. Refused attempts (another account) keep the code valid. Without a server (a browser) or a home network:
 * 'offline'.
 */
export function usePairingServer(
  server: PairingServer | null,
  options: {
    /** Sign-in and media data only: device settings stay on each device (D-060). */
    storages: BackupStorages;
    reload: () => Promise<void>;
    /** TV: a key for remote play (D-061), handed to the phone with the answer. */
    remoteOffer?: () => Promise<RemoteOffer | undefined>;
    /** TV: keeps the phone's remote key once pairing succeeded. */
    paired?: (remote: RemoteOffer | undefined) => Promise<void>;
  },
): PairingServerState {
  const [state, setState] = useState<PairingServerState>({ phase: 'starting' });
  useEffect(() => {
    if (!server) {
      setState({ phase: 'offline' });
      return;
    }
    let active = true;
    let finished = false;
    let unsubscribe = () => {};
    void (async () => {
      let offer: Awaited<ReturnType<PairingServer['start']>>;
      try {
        offer = await server.start();
      } catch (error) {
        appLog.warn('pairing', `server did not start: ${errorMessage(error)}`);
        if (active) setState({ phase: 'offline' });
        return;
      }
      if (!active) return void server.stop();
      if (!offer.host) {
        void server.stop();
        return setState({ phase: 'offline' });
      }
      const qr = pairingQrText({ host: offer.host, port: offer.port, key: offer.key });
      setState({ phase: 'ready', qr, error: null });
      unsubscribe = server.onRequest(({ id, body }) => {
        void (async () => {
          if (finished) return server.respond(id, 410, '');
          try {
            setState({ phase: 'working', qr });
            const remote = await options.remoteOffer?.();
            const reply = await acceptPairing(options.storages, offer.key, body, { remote });
            const result = reply.result;
            if (result?.ok) finished = true;
            await server.respond(id, reply.status, reply.body);
            if (!result) {
              appLog.warn('pairing', 'request with a wrong key ignored');
              setState({ phase: 'ready', qr, error: null });
            } else if (!result.ok) {
              appLog.warn('pairing', `refused: ${result.error}`);
              setState({ phase: 'ready', qr, error: pairingMessage(result.error) });
            } else {
              appLog.info('pairing', `${result.mode === 'login' ? 'signed in' : 'synced'} with a phone`);
              void server.stop();
              await options.paired?.(remote);
              await options.reload();
              setState({ phase: 'done', mode: result.mode, accountName: result.accountName });
            }
          } catch (error) {
            void server.respond(id, 500, '');
            appLog.warn('pairing', errorMessage(error));
            setState({ phase: 'ready', qr, error: t('Something went wrong. Scan the code again.') });
          }
        })();
      });
    })();
    return () => {
      active = false;
      unsubscribe();
      void server.stop();
    };
    // The server and options are fixed for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}
