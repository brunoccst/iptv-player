import { useEffect } from 'react';
import { createStore } from 'zustand/vanilla';
import {
  appLog,
  errorMessage,
  openRemoteRequest,
  REMOTE_PORTS,
  RemoteFailure,
  sendRemoteCommand,
  type PairedPhone,
  type PairedTv,
  type PlayTarget,
  type RemoteOffer,
} from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { backupStorages, navStore, stores } from '../appContext';
import { currentRoute } from '../navigation/navStore';

/** Remote play (D-061). Keys live in the Keystore-backed storage; they are not part of backups. */
const secure = backupStorages.secure;
export const PAIRED_TV_KEY = 'remote.tv';
export const PAIRED_PHONES_KEY = 'remote.phones';
const TV_ID_KEY = 'remote.tvId';
/** A TV remembers this many phones; the oldest pairing drops out. */
const MAX_PHONES = 5;

const readJson = async <T>(key: string): Promise<T | null> => {
  try {
    return JSON.parse((await secure.getItem(key)) ?? 'null') as T | null;
  } catch {
    return null;
  }
};

/** Phone: the TV it was paired with, if any. */
export const pairedTv = createStore<{ tv: PairedTv | null; load(): Promise<void>; save(tv: PairedTv): Promise<void> }>()((set) => ({
  tv: null,
  async load() {
    set({ tv: await readJson<PairedTv>(PAIRED_TV_KEY) });
  },
  async save(tv) {
    set({ tv });
    await secure.setItem(PAIRED_TV_KEY, JSON.stringify(tv));
  },
}));

/** Port the TV's remote server runs on (null while it is not running). */
let remotePort: number | null = null;

/** TV: the remote-play key for the phone that is pairing now (handed over in the encrypted pairing answer). */
export async function remoteOffer(): Promise<RemoteOffer> {
  let tvId = await secure.getItem(TV_ID_KEY);
  if (!tvId) {
    tvId = TvMedia.randomKey()
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 16);
    await secure.setItem(TV_ID_KEY, tvId);
  }
  return {
    tvId,
    tvName: TvMedia.deviceName(),
    phoneId: TvMedia.randomKey()
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 16),
    key: TvMedia.randomKey(),
    port: remotePort ?? REMOTE_PORTS[0]!,
  };
}

/** TV: keeps the key of a phone that paired successfully. */
export async function rememberPhone(offer: RemoteOffer): Promise<void> {
  const phones = (await readJson<PairedPhone[]>(PAIRED_PHONES_KEY)) ?? [];
  const phone: PairedPhone = { phoneId: offer.phoneId, key: offer.key, pairedAt: new Date().toISOString() };
  await secure.setItem(PAIRED_PHONES_KEY, JSON.stringify([...phones, phone].slice(-MAX_PHONES)));
}

/**
 * TV: while signed in, listens for paired phones and plays what they send (D-061). Answers 403 to anything not sealed
 * by a paired phone.
 */
export function useRemoteServer(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    try {
      remotePort = TvMedia.startRemote(REMOTE_PORTS).port;
      appLog.info('remote', `listening on port ${remotePort}`);
    } catch (error) {
      appLog.warn('remote', `server did not start: ${errorMessage(error)}`);
      return;
    }
    const subscription = TvMedia.addListener('onRemoteRequest', ({ id, body }) => {
      void (async () => {
        const phones = (await readJson<PairedPhone[]>(PAIRED_PHONES_KEY)) ?? [];
        const opened = openRemoteRequest(phones, body);
        if (!opened) {
          appLog.warn('remote', 'request from an unknown phone ignored');
          return TvMedia.respondRemote(id, 403, 'forbidden');
        }
        const { command, reply } = opened;
        const session = stores.session.getState();
        if (command.type !== 'play' || !command.target?.streamId)
          return TvMedia.respondRemote(id, 200, reply({ ok: false, error: 'bad-request' }));
        if (session.account?.id !== command.accountId) return TvMedia.respondRemote(id, 200, reply({ ok: false, error: 'other-account' }));
        if (!session.activeProfileId) return TvMedia.respondRemote(id, 200, reply({ ok: false, error: 'no-profile' }));

        appLog.info('remote', `play from phone: ${command.target.kind} ${command.target.streamId}`);
        const nav = navStore.getState();
        const route = { name: 'player' as const, target: command.target };
        if (currentRoute(nav).name === 'player') nav.replaceTop(route);
        else nav.push(route);
        TvMedia.respondRemote(id, 200, reply({ ok: true }));
      })();
    });
    return () => {
      subscription.remove();
      TvMedia.stopRemote();
      remotePort = null;
    };
  }, [enabled]);
}

/** Phone: starts `target` on the paired TV. Resolves with a message for the user; rejects with one on failure. */
export async function playOnTv(target: PlayTarget): Promise<string> {
  const tv = pairedTv.getState().tv;
  const accountId = stores.session.getState().account?.id;
  if (!tv || !accountId) throw new Error('Connect a TV first: account menu → Connect a TV.');
  try {
    const { port } = await sendRemoteCommand(tv, { type: 'play', accountId, target });
    if (port !== tv.port) await pairedTv.getState().save({ ...tv, port });
    appLog.info('remote', `sent ${target.kind} ${target.streamId} to the TV`);
    return `Playing on ${tv.tvName}.`;
  } catch (error) {
    appLog.warn('remote', errorMessage(error));
    throw error instanceof RemoteFailure ? error : new Error('Something went wrong. Try again.');
  }
}
