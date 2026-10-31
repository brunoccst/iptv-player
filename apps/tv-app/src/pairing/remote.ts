import { useEffect } from 'react';
import { AppState } from 'react-native';
import { createStore } from 'zustand/vanilla';
import {
  answerSync,
  AUTO_SYNC_INTERVAL_MS,
  createAutoSync,
  syncWithTv,
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
  t,
} from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { appContext, backupStorages, navStore, stores } from '../appContext';
import { currentRoute } from '../navigation/navStore';
import { logReport } from '../diagnostics/logReport';

/** Remote play (D-061). Keys live in the Keystore-backed storage; they are not part of backups. */
const secure = backupStorages.secure;
/** Automatic sync (issue #227): sign-in and media data only, as pairing (D-060). */
const syncStorages = { secure: backupStorages.secure, data: backupStorages.data };
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

export const PAIRED_COMPUTER_KEY = 'remote.computer';

/**
 * Phone: the TV it was paired with, if any, and the computer (the desktop app, issue #268, DECISIONS.md#d-240). Each
 * is synced with on its own; Play on TV and the TV log go to the TV only. `save` puts a device in its slot by `kind`.
 */
export const pairedTv = createStore<{
  tv: PairedTv | null;
  computer: PairedTv | null;
  load(): Promise<void>;
  save(device: PairedTv): Promise<void>;
}>()((set) => ({
  tv: null,
  computer: null,
  async load() {
    set({ tv: await readJson<PairedTv>(PAIRED_TV_KEY), computer: await readJson<PairedTv>(PAIRED_COMPUTER_KEY) });
  },
  async save(device) {
    if (device.kind === 'computer') {
      set({ computer: device });
      await secure.setItem(PAIRED_COMPUTER_KEY, JSON.stringify(device));
      return;
    }
    set({ tv: device });
    await secure.setItem(PAIRED_TV_KEY, JSON.stringify(device));
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
 * TV: while signed in, listens for paired phones, plays what they send (D-061) and hands them its log (D-039). Answers
 * 403 to anything not sealed by a paired phone.
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
        if (command.type === 'log') {
          appLog.info('remote', 'log sent to a phone');
          return TvMedia.respondRemote(id, 200, reply({ ok: true, log: logReport() }));
        }
        if (command.type === 'sync') {
          // A paired device's profiles, progress and My List, merged with this TV's (issue #227).
          const { reply: answer, changed, signIn } = await answerSync(syncStorages, command);
          TvMedia.respondRemote(id, 200, reply(answer));
          appLog.info('sync', answer.ok ? (changed ? 'synced with a device' : 'in step with a device') : `sync refused: ${answer.error}`);
          // A new provider server, username or password from the device (DECISIONS.md#d-228).
          if (signIn) await appContext.reload();
          else if (changed) await appContext.refreshMedia();
          return;
        }
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

/** The device answered on another port, or on a new address from the router (issue #268): the next command goes there. */
async function savedWhereItAnswered(tv: PairedTv, host: string, port: number) {
  if (host === tv.host && port === tv.port) return;
  if (host !== tv.host) appLog.info('remote', `found the ${tv.kind === 'computer' ? 'computer' : 'TV'} on a new address`);
  await pairedTv.getState().save({ ...tv, host, port });
}

/** Phone and tablet: one automatic sync with the paired TV (issue #227) and the paired computer (issue #268). */
const autoSync = createAutoSync(async () => {
  const accountId = stores.session.getState().account?.id;
  if (!accountId) return;
  const { tv, computer } = pairedTv.getState();
  let failure: unknown = null;
  for (const device of [tv, computer]) {
    if (!device) continue;
    const name = device.kind === 'computer' ? 'computer' : 'TV';
    try {
      const { host, port, changed, signIn } = await syncWithTv(syncStorages, device, accountId);
      await savedWhereItAnswered(device, host, port);
      appLog.info('sync', changed ? `synced with the ${name}` : `in step with the ${name}`);
      // A new provider server, username or password from the other device (DECISIONS.md#d-228).
      if (signIn) return appContext.reload();
      if (changed) await appContext.refreshMedia();
    } catch (error) {
      // The other one may still answer (the TV off, the computer on).
      failure ??= error;
    }
  }
  if (failure) throw failure;
});

/**
 * Phone and tablet: while `enabled` (signed in, a paired TV), syncs profiles, progress and My List with the TV when the
 * app opens or comes back to the front, and every 10 minutes (issue #227, DECISIONS.md#d-186).
 */
export function useAutoSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void autoSync.request();
    const timer = setInterval(() => void autoSync.request(), AUTO_SYNC_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void autoSync.request();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled]);
}

/** Phone: starts `target` on the paired TV. Resolves with a message for the user; rejects with one on failure. */
export async function playOnTv(target: PlayTarget): Promise<string> {
  const tv = pairedTv.getState().tv;
  const accountId = stores.session.getState().account?.id;
  if (!tv || !accountId) throw new Error(t('Connect a TV first: account menu → Sync with another device → Scan a code.'));
  try {
    const { host, port } = await sendRemoteCommand(tv, { type: 'play', accountId, target });
    await savedWhereItAnswered(tv, host, port);
    appLog.info('remote', `sent ${target.kind} ${target.streamId} to the TV`);
    return t('Playing on {tv}.', { tv: tv.tvName });
  } catch (error) {
    appLog.warn('remote', errorMessage(error));
    throw error instanceof RemoteFailure ? error : new Error(t('Something went wrong. Try again.'));
  }
}

/** Phone: the paired TV's diagnostics log, masked on the TV (D-039). Rejects with a message for the user. */
export async function getTvLog(): Promise<{ tvName: string; log: string }> {
  const tv = pairedTv.getState().tv;
  if (!tv) throw new Error(t('Connect a TV first: account menu → Sync with another device → Scan a code.'));
  try {
    const { host, port, log } = await sendRemoteCommand(tv, { type: 'log' });
    await savedWhereItAnswered(tv, host, port);
    if (log === undefined) throw new RemoteFailure('bad-request', tv.tvName);
    appLog.info('remote', 'got the TV log');
    return { tvName: tv.tvName, log };
  } catch (error) {
    appLog.warn('remote', errorMessage(error));
    throw error instanceof RemoteFailure ? error : new Error(t('Something went wrong. Try again.'));
  }
}
