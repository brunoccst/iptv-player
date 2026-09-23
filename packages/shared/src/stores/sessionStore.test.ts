import { beforeEach, describe, expect, it } from 'vitest';
import { createAppContext } from '../appContext';
import { account, createFakeBackend, profile, type FakeBackend } from '../testing/fakeBackend';
import { SESSION_STORAGE_KEY, selectActiveProfile } from './sessionStore';
import { createMemoryStorage } from './storage';

const config = { appName: 'Test', appSlug: 'test', apiBaseUrl: 'http://api.test' };

describe('session store', () => {
  let backend: FakeBackend;
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    backend = createFakeBackend();
    storage = createMemoryStorage();
  });

  const create = () => createAppContext({ config, storage, fetch: backend.fetch }).stores.session;

  it('login stores token, auto-selects a single profile and persists', async () => {
    backend.on('POST', '/api/auth/login', { body: { token: 'tok', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile('p1')] } });
    const session = create();

    await expect(session.getState().login({ serverUrl: 's', username: 'u', password: 'p' })).resolves.toBe(true);

    expect(session.getState()).toMatchObject({ status: 'authenticated', token: 'tok', activeProfileId: 'p1', busy: false });
    expect(JSON.parse(storage.data.get(SESSION_STORAGE_KEY)!)).toMatchObject({ token: 'tok', activeProfileId: 'p1' });
  });

  it('login failure keeps user anonymous and exposes the error code', async () => {
    backend.on('POST', '/api/auth/login', { status: 401, body: { detail: 'Invalid', code: 'invalid_provider_credentials' } });
    const session = create();

    await expect(session.getState().login({ serverUrl: 's', username: 'u', password: 'x' })).resolves.toBe(false);

    expect(session.getState().token).toBeNull();
    expect(session.getState().error?.code).toBe('invalid_provider_credentials');
  });

  it('restore validates the stored token and refreshes account + profiles', async () => {
    storage.data.set(SESSION_STORAGE_KEY, JSON.stringify({ token: 'tok', account, profiles: [profile('old')], activeProfileId: 'p2' }));
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [profile('p1'), profile('p2')] });
    const session = create();

    await session.getState().restore();

    expect(session.getState()).toMatchObject({ status: 'authenticated', activeProfileId: 'p2', offline: false });
    expect(selectActiveProfile(session.getState())?.id).toBe('p2');
    expect(backend.calls[0]!.headers.Authorization).toBe('Bearer tok');
  });

  it('restore with a revoked token signs out and clears storage', async () => {
    storage.data.set(SESSION_STORAGE_KEY, JSON.stringify({ token: 'old', account, profiles: [], activeProfileId: null }));
    backend.on('GET', '/api/auth/me', { status: 401 });
    backend.on('GET', '/api/profiles', { status: 401 });
    const session = create();

    await session.getState().restore();

    expect(session.getState()).toMatchObject({ status: 'anonymous', token: null });
    expect(storage.data.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('restore while backend is unreachable keeps cached session in offline mode', async () => {
    storage.data.set(SESSION_STORAGE_KEY, JSON.stringify({ token: 'tok', account, profiles: [profile('p1')], activeProfileId: 'p1' }));
    backend.on('GET', '/api/auth/me', { networkError: true });
    backend.on('GET', '/api/profiles', { networkError: true });
    const session = create();

    await session.getState().restore();

    expect(session.getState()).toMatchObject({ status: 'authenticated', offline: true, activeProfileId: 'p1' });
  });

  it('restore without stored session or with corrupt data is anonymous', async () => {
    const session = create();
    await session.getState().restore();
    expect(session.getState().status).toBe('anonymous');

    storage.data.set(SESSION_STORAGE_KEY, '{not json');
    await session.getState().restore();
    expect(session.getState().status).toBe('anonymous');
  });

  it('logout clears locally even when the API call fails', async () => {
    storage.data.set(SESSION_STORAGE_KEY, JSON.stringify({ token: 'tok', account, profiles: [], activeProfileId: null }));
    backend.on('GET', '/api/auth/me', { body: account });
    backend.on('GET', '/api/profiles', { body: [] });
    backend.on('POST', '/api/auth/logout', { networkError: true });
    const session = create();
    await session.getState().restore();

    await session.getState().logout();

    expect(session.getState()).toMatchObject({ status: 'anonymous', token: null, account: null });
    expect(storage.data.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('profile mutations update the list and active profile', async () => {
    backend.on('POST', '/api/auth/login', { body: { token: 'tok', expiresAt: '2030-01-01T00:00:00Z', account, profiles: [profile('p1'), profile('p2')] } });
    backend.on('POST', '/api/profiles', { status: 201, body: profile('p3', 'Kids') });
    backend.on('PUT', '/api/profiles/p1', { body: profile('p1', 'Renamed') });
    backend.on('DELETE', '/api/profiles/p2', { status: 204 });
    backend.on('DELETE', '/api/profiles/p1', { status: 400, body: { detail: 'The last profile cannot be deleted.', code: 'validation_failed' } });
    const session = create();
    await session.getState().login({ serverUrl: 's', username: 'u', password: 'p' });
    expect(session.getState().activeProfileId).toBeNull();

    session.getState().selectProfile('p2');
    session.getState().selectProfile('does-not-exist');
    expect(session.getState().activeProfileId).toBe('p2');

    await session.getState().createProfile({ name: 'Kids', isKids: true });
    await session.getState().updateProfile('p1', { name: 'Renamed', isKids: false });
    await expect(session.getState().deleteProfile('p2')).resolves.toBe(true);

    expect(session.getState().profiles.map((p) => p.name)).toEqual(['Renamed', 'Kids']);
    expect(session.getState().activeProfileId).toBeNull();

    await expect(session.getState().deleteProfile('p1')).resolves.toBe(false);
    expect(session.getState().error?.code).toBe('validation_failed');
  });
});
