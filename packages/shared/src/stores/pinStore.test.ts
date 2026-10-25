import { describe, expect, it } from 'vitest';
import type { ProfileDto } from '../api/types';
import { createTestAppContext } from '../testing/fakeBackend';
import { account, createFakeBackend } from '../testing/fakeBackend';
import { MAX_PIN_TRIES, needsPinToManage, needsPinToOpen, newerPin, PIN_LOCK_MS, pinStorageKey } from './pinStore';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';

const config = { appName: 'Test', appSlug: 'test' };

async function setup() {
  const backend = createFakeBackend();
  backend.on('GET', '/api/auth/me', { body: account });
  backend.on('GET', '/api/profiles', { body: [] });
  backend.on('POST', '/api/auth/logout', { status: 204 });
  const storage = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [], activeProfileId: null }),
  });
  const { stores } = createTestAppContext({ config, storage, backend });
  await stores.session.getState().restore();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { stores, storage, pin: stores.pin };
}

const profile = (isKids: boolean) => ({ id: isKids ? 'kid' : 'adult', name: 'x', avatarKey: null, isKids }) as ProfileDto;

describe('pin store', () => {
  it('is optional: no PIN means nothing is locked', async () => {
    const { pin } = await setup();
    expect(pin.getState().status).toBe('none');
    expect(needsPinToOpen('none', profile(true), profile(false))).toBe(false);
    expect(needsPinToManage('none')).toBe(false);
  });

  it('sets, verifies, changes and removes the PIN, storing only a hash', async () => {
    const { pin, storage } = await setup();
    expect(await pin.getState().setPin('12a4')).toBe('wrong');
    expect(await pin.getState().setPin('1234')).toBe('ok');
    expect(pin.getState().status).toBe('set');
    // Only a salt, a hash and the date are stored, never the PIN. (Not a substring check: a random hex hash can contain "1234".)
    const stored = JSON.parse(storage.data.get(pinStorageKey(account.id))!) as Record<string, string>;
    expect(Object.keys(stored).sort()).toEqual(['changedAt', 'hash', 'salt']);
    expect(Object.values(stored)).not.toContain('1234');
    expect(stored.hash).toMatch(/^[0-9a-f]{40,}$/);

    expect(await pin.getState().verify('0000')).toBe('wrong');
    expect(await pin.getState().verify('1234')).toBe('ok');
    expect(await pin.getState().setPin('5678', '0000')).toBe('wrong');
    expect(await pin.getState().setPin('5678', '1234')).toBe('ok');
    expect(await pin.getState().removePin('1234')).toBe('wrong');
    expect(await pin.getState().removePin('5678')).toBe('ok');
    expect(pin.getState().status).toBe('none');
    // The removal keeps its date for syncing (DECISIONS.md#d-229).
    expect(Object.keys(JSON.parse(storage.data.get(pinStorageKey(account.id))!) as object)).toEqual(['changedAt']);
    await pin.getState().refresh();
    expect(pin.getState().status).toBe('none');
  });

  it('refresh reads a PIN another device synced', async () => {
    const { pin, storage } = await setup();
    await pin.getState().setPin('1234');
    const saved = storage.data.get(pinStorageKey(account.id))!;
    await pin.getState().removePin('1234');
    await storage.setItem(pinStorageKey(account.id), saved);
    await pin.getState().refresh();
    expect(pin.getState().status).toBe('set');
  });

  it('newerPin keeps the later change; an undated PIN only goes where none was set (DECISIONS.md#d-229)', () => {
    const early = JSON.stringify({ salt: 's', hash: 'a', changedAt: '2026-10-20T10:00:00.000Z' });
    const late = JSON.stringify({ salt: 's', hash: 'b', changedAt: '2026-10-24T10:00:00.000Z' });
    const removedLate = JSON.stringify({ changedAt: '2026-10-25T10:00:00.000Z' });
    const undated = JSON.stringify({ salt: 's', hash: 'c' });
    expect(newerPin(late, early)).toBe(late);
    expect(newerPin(early, late)).toBeNull();
    expect(newerPin(removedLate, late)).toBe(removedLate);
    expect(newerPin(late, null)).toBe(late);
    expect(newerPin(early, undated)).toBe(early);
    expect(newerPin(undated, null)).toBe(undated);
    expect(newerPin(undated, early)).toBeNull();
    expect(newerPin(undated, removedLate)).toBeNull();
    expect(newerPin('not json', null)).toBeNull();
    expect(newerPin(undefined, early)).toBeNull();
  });

  it('locks for a minute after too many wrong tries', async () => {
    const { pin } = await setup();
    await pin.getState().setPin('1234');
    for (let i = 0; i < MAX_PIN_TRIES; i++) expect(await pin.getState().verify('0000')).toBe('wrong');
    expect(await pin.getState().verify('1234')).toBe('locked');
    expect(pin.getState().lockedUntil! - Date.now()).toBeLessThanOrEqual(PIN_LOCK_MS);
  });

  it('needs the PIN to open a regular profile from a Kids profile or the picker, not to switch between regular ones', () => {
    expect(needsPinToOpen('set', profile(true), profile(false))).toBe(true);
    expect(needsPinToOpen('set', null, profile(false))).toBe(true);
    expect(needsPinToOpen('set', profile(false), profile(false))).toBe(false);
    expect(needsPinToOpen('set', null, profile(true))).toBe(false);
    expect(needsPinToManage('set')).toBe(true);
  });

  it('forgets the PIN on sign-out', async () => {
    const { pin, stores, storage } = await setup();
    await pin.getState().setPin('1234');
    await stores.session.getState().logout();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(storage.data.has(pinStorageKey(account.id))).toBe(false);
    expect(pin.getState().status).toBe('unknown');
  });
});
