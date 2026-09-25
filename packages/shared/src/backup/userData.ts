import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { CREDENTIALS_KEY, profilesKey, progressKey, watchlistKey } from '../direct/directApiClient';
import { CONNECTION_STORAGE_KEY } from '../stores/connectionStore';
import { pinStorageKey } from '../stores/pinStore';
import { SESSION_STORAGE_KEY } from '../stores/sessionStore';
import type { KeyValueStorage } from '../stores/storage';

/**
 * User-data backup (D-056): the device's settings and per-profile data in one password-protected file, so a reinstall
 * or a new device starts where the old one left off. Library caches and downloads stay out (they are rebuilt or
 * tied to the device).
 */
export const BACKUP_FORMAT = 'iptv-player-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_FILE_EXTENSION = '.iptvbackup';
export const MIN_BACKUP_PASSWORD = 8;
const ITERATIONS = 100_000;

export interface BackupStorages {
  /** Session, connection, provider credentials, PIN. */
  secure: KeyValueStorage;
  /** Direct-mode profiles, progress and My List (native apps; the web has none). */
  data?: KeyValueStorage;
}

interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: 'XChaCha20-Poly1305';
  nonce: string;
  data: string;
}

interface BackupContents {
  secure: Record<string, string>;
  data: Record<string, string>;
}

export type BackupError = 'no-data' | 'short-password' | 'not-a-backup' | 'wrong-password' | 'newer-version';

export class BackupFailure extends Error {
  constructor(readonly reason: BackupError) {
    super(backupMessage(reason));
  }
}

export function backupMessage(reason: BackupError): string {
  switch (reason) {
    case 'no-data':
      return 'There is nothing to back up yet. Sign in first.';
    case 'short-password':
      return `The password must have at least ${MIN_BACKUP_PASSWORD} characters.`;
    case 'not-a-backup':
      return 'This file is not a backup from this app.';
    case 'wrong-password':
      return 'Wrong password, or the file is damaged.';
    case 'newer-version':
      return 'This backup was made by a newer version of the app. Update the app first.';
  }
}

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
/** UTF-8 by hand: TextDecoder is not available on every JS engine the apps run on (Hermes). */
const utf8 = (text: string) => {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(bytes);
};
/** JSON with every non-ASCII character escaped, so bytes and characters map one to one. */
const asciiJson = (value: unknown) =>
  JSON.stringify(value).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const fromAscii = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

/** Web Crypto when available. Otherwise Math.random: salt and nonce must be unique, not secret, and each backup gets a fresh salt, so a fresh key. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

const deriveKey = (password: string, salt: Uint8Array, iterations: number) =>
  pbkdf2Async(sha256, utf8(password), salt, { c: iterations, dkLen: 32, asyncTick: 20 });

const parse = <T>(value: string | null): T | null => {
  try {
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};

/** Keys that exist for the signed-in account on this device. */
async function collect(storages: BackupStorages): Promise<BackupContents> {
  const secure: Record<string, string> = {};
  const data: Record<string, string> = {};
  const read = async (storage: KeyValueStorage, key: string, into: Record<string, string>) => {
    const value = await storage.getItem(key);
    if (value !== null) into[key] = value;
  };

  for (const key of [SESSION_STORAGE_KEY, CONNECTION_STORAGE_KEY, CREDENTIALS_KEY]) await read(storages.secure, key, secure);
  const session = parse<{ account?: { id: string }; profiles?: { id: string }[] }>(secure[SESSION_STORAGE_KEY] ?? null);
  const accountId = session?.account?.id;
  if (!accountId) throw new BackupFailure('no-data');
  await read(storages.secure, pinStorageKey(accountId), secure);

  if (storages.data) {
    await read(storages.data, profilesKey(accountId), data);
    const profiles = parse<{ id: string }[]>(data[profilesKey(accountId)] ?? null) ?? session?.profiles ?? [];
    for (const { id } of profiles) {
      await read(storages.data, progressKey(id), data);
      await read(storages.data, watchlistKey(id), data);
    }
  }
  return { secure, data };
}

/** The backup file's text. The password is needed to restore it; it is not stored anywhere. */
export async function exportUserData(storages: BackupStorages, password: string, now = new Date()): Promise<string> {
  if (password.length < MIN_BACKUP_PASSWORD) throw new BackupFailure('short-password');
  const contents = await collect(storages);
  const salt = randomBytes(16);
  const nonce = randomBytes(24);
  const key = await deriveKey(password, salt, ITERATIONS);
  const sealed = xchacha20poly1305(key, nonce).encrypt(Uint8Array.from(asciiJson(contents), (c) => c.charCodeAt(0)));
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    kdf: { name: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toBase64(salt) },
    cipher: 'XChaCha20-Poly1305',
    nonce: toBase64(nonce),
    data: toBase64(sealed),
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Restores a backup over this device's data for that account (other accounts' data stays). The app must then reload
 * its state (`AppContext.reload()`, or a page reload on the web). This device's downloads stay only if they belong to the
 * restored account (D-050).
 */
export async function importUserData(storages: BackupStorages, text: string, password: string): Promise<{ createdAt: string }> {
  const file = parse<BackupFile>(text);
  if (!file || file.format !== BACKUP_FORMAT || typeof file.data !== 'string') throw new BackupFailure('not-a-backup');
  if (file.version > BACKUP_VERSION) throw new BackupFailure('newer-version');

  let contents: BackupContents;
  try {
    const key = await deriveKey(password, fromBase64(file.kdf.salt), file.kdf.iterations);
    const plain = xchacha20poly1305(key, fromBase64(file.nonce)).decrypt(fromBase64(file.data));
    contents = JSON.parse(fromAscii(plain)) as BackupContents;
  } catch {
    throw new BackupFailure('wrong-password');
  }

  for (const [key, value] of Object.entries(contents.secure ?? {})) await storages.secure.setItem(key, value);
  const data = storages.data ?? storages.secure;
  for (const [key, value] of Object.entries(contents.data ?? {})) await data.setItem(key, value);
  return { createdAt: file.createdAt };
}
