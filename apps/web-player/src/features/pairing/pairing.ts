import { usePairingServer as usePairing } from '@iptv/shared';
import { appContext, backupStorages } from '../../appContext';
import { desktop } from '../../desktop';

/** Sign-in and media data only; settings stay on each device (D-060). */
const storages = { secure: backupStorages.secure, data: backupStorages.data };

export type { PairingServerState } from '@iptv/shared';

/**
 * Desktop app, computer side of phone pairing (D-072, protocol D-060): the shared hook (D-124) with the app's pairing
 * server in the main process. Not available in a browser.
 */
export const usePairingServer = () => usePairing(desktop?.pairing ?? null, { storages, reload: () => appContext.reload() });
