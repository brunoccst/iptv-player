import { describe, expect, it } from 'vitest';
import type { ProfileDto } from '../api/types';
import { createAppContext } from '../appContext';
import { account, createFakeBackend } from '../testing/fakeBackend';
import { MAX_PIN_TRIES, needsPinToManage, needsPinToOpen, PIN_LOCK_MS, pinStorageKey } from './pinStore';
import { SESSION_STORAGE_KEY } from './sessionStore';
import { createMemoryStorage } from './storage';

const config = { appName: 'Test', appSlug: 'test', apiBaseUrl: 'http://api.test' };

async function setup() {
  const backend = createFakeBackend();
  backend.on('GET', '/api/auth/me', { body: account });
  backend.on('GET', '/api/profiles', { body: [] });
  backend.on('POST', '/api/auth/logout', { status: 204 });
  const storage = createMemoryStorage({
    [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'tok', account, profiles: [], activeProfileId: null }),
  });
  const { stores } = createAppContext({ config, storage, fetch: backend.fetch });
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
    expect(storage.data.get(pinStorageKey(account.id))).not.toContain('1234');

    expect(await pin.getState().verify('0000')).toBe('wrong');
    expect(await pin.getState().verify('1234')).toBe('ok');
    expect(await pin.getState().setPin('5678', '0000')).toBe('wrong');
    expect(await pin.getState().setPin('5678', '1234')).toBe('ok');
    expect(await pin.getState().removePin('1234')).toBe('wrong');
    expect(await pin.getState().removePin('5678')).toBe('ok');
    expect(pin.getState().status).toBe('none');
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
