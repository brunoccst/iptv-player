import { createStore } from 'zustand/vanilla';
import type { ProfileDto } from '../api/types';
import { sha1Hex } from '../direct/normalizer/sha1';
import type { SessionStore } from './sessionStore';
import type { KeyValueStorage } from './storage';

/**
 * Optional parental PIN (D-054), saved per account on this device as a salted hash. When set, it is needed to open a
 * regular profile from a Kids profile or the picker, to add/edit/delete profiles, and to change or remove the PIN.
 * Signing out removes it, so a forgotten PIN costs one sign-in with the provider password.
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
    try {
      return JSON.parse((await storage.getItem(pinStorageKey(id))) ?? 'null') as { salt: string; hash: string } | null;
    } catch {
      return null;
    }
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
        await storage.setItem(pinStorageKey(id), JSON.stringify({ salt, hash: hash(salt, newPin) }));
        set({ status: 'set' });
        return 'ok';
      },
      async removePin(currentPin) {
        const result = await check(currentPin);
        if (result !== 'ok') return result;
        const id = accountId();
        if (id) await storage.removeItem(pinStorageKey(id));
        set({ status: 'none' });
        return 'ok';
      },
    };
  });

  const load = async () => store.setState({ status: accountId() ? ((await read()) ? 'set' : 'none') : 'unknown' });
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
