import { createStore } from 'zustand/vanilla';
import type { ProfileDto } from '../api/types';
import { sha1Hex } from '../direct/normalizer/sha1';
import type { SessionStore } from './sessionStore';
import type { KeyValueStorage } from './storage';

/**
 * Optional parental PIN (D-054), saved per account on this device as a salted hash. When set, it is needed to open a
 * regular profile from a Kids profile or the picker, to add/edit/delete profiles, and to change or remove the PIN.
 * Signing out removes it, so a forgotten PIN costs one sign-in with the provider password. The saved value carries when
 * it was set or removed (`changedAt`; a removal keeps only the date), so syncing devices keep the later change
 * (`newerPin`, DECISIONS.md#d-229).
 */
export type PinStatus = 'unknown' | 'none' | 'set';
export type PinResult = 'ok' | 'wrong' | 'locked';

export interface PinState {
  status: PinStatus;
  /** Epoch ms until which checks are refused after too many wrong tries. */
  lockedUntil: number | null;
  verify(pin: string): Promise<PinResult>;
  /** `currentPin` is required when a PIN is already set. */
  setPin(newPin: string, currentPin?: string): Promise<PinResult>;
  removePin(currentPin: string): Promise<PinResult>;
  /** Reads the saved PIN again (after a sync or pairing changed it). */
  refresh(): Promise<void>;
}

/** As saved: a PIN, or only `changedAt` when it was removed. Undated when saved before DECISIONS.md#d-229. */
interface SavedPin {
  salt?: string;
  hash?: string;
  changedAt?: string;
}

const parsePin = (text: string | null | undefined): SavedPin | null => {
  try {
    const value = JSON.parse(text ?? 'null') as SavedPin | null;
    return value && typeof value === 'object' && (typeof value.hash === 'string' || typeof value.changedAt === 'string') ? value : null;
  } catch {
    return null;
  }
};

/**
 * The PIN of the later change (DECISIONS.md#d-229): `incoming` (another device's saved PIN, as stored) when it was set
 * or removed after `local`, else null (keep this device's). An undated PIN only goes where none was ever set, as pairing
 * always did (D-060).
 */
export function newerPin(incoming: string | null | undefined, local: string | null): string | null {
  const theirs = parsePin(incoming);
  if (!theirs || incoming === local) return null;
  const ours = parsePin(local);
  if (!theirs.changedAt) return ours ? null : incoming!;
  return ours?.changedAt && ours.changedAt >= theirs.changedAt ? null : incoming!;
}

export const PIN_LENGTH = 4;
export const MAX_PIN_TRIES = 5;
export const PIN_LOCK_MS = 60_000;
const HASH_ROUNDS = 1000;

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
export const pinStorageKey = (accountId: string) => `pin.${accountId}`;

/** Opening `target` needs the PIN when one is set, `target` is not a Kids profile, and no regular profile is active. */
export function needsPinToOpen(status: PinStatus, current: ProfileDto | null, target: ProfileDto): boolean {
  return status === 'set' && !target.isKids && !(current && !current.isKids);
}

/** Adding, editing or deleting profiles needs the PIN when one is set. */
export const needsPinToManage = (status: PinStatus) => status === 'set';

function hash(salt: string, pin: string) {
  let value = `${salt}:${pin}`;
  for (let round = 0; round < HASH_ROUNDS; round++) value = sha1Hex(`${salt}:${value}`);
  return value;
}

export function createPinStore({
  session,
  storage,
  now = () => Date.now(),
}: {
  session: SessionStore;
  storage: KeyValueStorage;
  now?: () => number;
}) {
  let failures = 0;
  const accountId = () => session.getState().account?.id ?? null;
  const read = async (): Promise<{ salt: string; hash: string } | null> => {
    const id = accountId();
    if (!id) return null;
    const saved = parsePin(await storage.getItem(pinStorageKey(id)));
    return saved?.salt !== undefined && saved.hash !== undefined ? { salt: saved.salt, hash: saved.hash } : null;
  };

  const store = createStore<PinState>()((set, get) => {
    const check = async (pin: string): Promise<PinResult> => {
      const lockedUntil = get().lockedUntil;
      if (lockedUntil && lockedUntil > now()) return 'locked';
      const saved = await read();
      if (!saved) return 'ok';
      if (hash(saved.salt, pin) === saved.hash) {
        failures = 0;
        set({ lockedUntil: null });
        return 'ok';
      }
      failures += 1;
      if (failures >= MAX_PIN_TRIES) {
        failures = 0;
        set({ lockedUntil: now() + PIN_LOCK_MS });
      }
      return 'wrong';
    };

    return {
      status: 'unknown',
      lockedUntil: null,
      verify: check,
      async setPin(newPin, currentPin) {
        if (!isValidPin(newPin)) return 'wrong';
        if (get().status === 'set') {
          const result = await check(currentPin ?? '');
          if (result !== 'ok') return result;
        }
        const id = accountId();
        if (!id) return 'wrong';
        const salt = `${now().toString(36)}${Math.random().toString(36).slice(2)}`;
        await storage.setItem(
          pinStorageKey(id),
          JSON.stringify({ salt, hash: hash(salt, newPin), changedAt: new Date(now()).toISOString() } satisfies SavedPin),
        );
        set({ status: 'set' });
        return 'ok';
      },
      async removePin(currentPin) {
        const result = await check(currentPin);
        if (result !== 'ok') return result;
        const id = accountId();
        // The date stays, so the removal reaches the other devices instead of their PIN coming back.
        if (id) await storage.setItem(pinStorageKey(id), JSON.stringify({ changedAt: new Date(now()).toISOString() } satisfies SavedPin));
        set({ status: 'none' });
        return 'ok';
      },
      refresh: (): Promise<void> => load(),
    };
  });

  const load = async (): Promise<void> => store.setState({ status: accountId() ? ((await read()) ? 'set' : 'none') : 'unknown' });
  void load();
  session.subscribe((state, previous) => {
    if (state.account?.id === previous.account?.id) return;
    failures = 0;
    store.setState({ lockedUntil: null });
    // Signed out: the PIN goes too, so a forgotten PIN only costs a sign-in with the provider password.
    if (previous.account?.id && !state.account) void storage.removeItem(pinStorageKey(previous.account.id));
    void load();
  });
  return store;
}

export type PinStore = ReturnType<typeof createPinStore>;
