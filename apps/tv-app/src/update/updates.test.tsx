import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createMemoryStorage } from '@iptv/shared';
import { updater } from '../appContext';
import { nativeState } from '../../test/tvMediaMock';
import { createUpdater, releaseFrom } from './updates';
import { UpdateDialog } from './UpdateDialog';

const SHA = 'a'.repeat(64);
const releaseJson = (version: number) => ({
  body: `Built from abc1234 (push), version ${version}, signed with the release key, FFmpeg audio: true.`,
  updated_at: '2026-09-26T12:00:00Z',
  assets: [
    {
      name: 'tv.apk',
      state: 'uploaded',
      browser_download_url: 'https://github.com/o/r/releases/download/tv-apk/tv.apk',
      digest: `sha256:${SHA}`,
    },
  ],
});
const github = (json: unknown, status = 200) =>
  jest.fn(async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch & jest.Mock;

beforeEach(() => nativeState.reset());

describe('self-update (D-062)', () => {
  it('reads version, APK address and checksum from the tv-apk release', () => {
    expect(releaseFrom(releaseJson(32))).toEqual({
      versionCode: 32,
      apkUrl: 'https://github.com/o/r/releases/download/tv-apk/tv.apk',
      sha256: SHA,
      publishedAt: '2026-09-26T12:00:00Z',
    });
    expect(releaseFrom({ body: 'no version here', assets: releaseJson(1).assets })).toBeNull();
    expect(releaseFrom({ ...releaseJson(32), assets: [] })).toBeNull();
    expect(releaseFrom(null)).toBeNull();
  });

  it('offers a newer version; "Later" stops the automatic prompt for that version only', async () => {
    const fetch = github(releaseJson(32));
    const storage = createMemoryStorage();
    const updates = createUpdater({ repo: 'o/r', storage, fetch });
    await updates.check(true);
    expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/releases/tags/tv-apk', expect.anything());
    expect(updates.store.getState()).toMatchObject({ prompt: true, status: { phase: 'available', release: { versionCode: 32 } } });

    await updates.later();
    await updates.check(true);
    expect(updates.store.getState().prompt).toBe(false);
    // Asking from the menu still shows it.
    await updates.check();
    expect(updates.store.getState().prompt).toBe(true);

    const newer = createUpdater({ repo: 'o/r', storage, fetch: github(releaseJson(33)) });
    await newer.check(true);
    expect(newer.store.getState().prompt).toBe(true);
  });

  it('stays quiet when up to date, when checks fail automatically, and without a repository', async () => {
    const current = createUpdater({ repo: 'o/r', storage: createMemoryStorage(), fetch: github(releaseJson(31)) });
    await current.check(true);
    expect(current.store.getState()).toMatchObject({ prompt: false, status: { phase: 'current' } });

    const offline = createUpdater({ repo: 'o/r', storage: createMemoryStorage(), fetch: github({}, 500) });
    await offline.check(true);
    expect(offline.store.getState()).toMatchObject({ prompt: false, status: { phase: 'idle' } });
    await offline.check();
    expect(offline.store.getState()).toMatchObject({ prompt: true, status: { phase: 'failed' } });

    const fetch = github(releaseJson(32));
    await createUpdater({ repo: '', storage: createMemoryStorage(), fetch }).check();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('downloads with the checksum and opens the installer; explains a different signing key', async () => {
    const updates = createUpdater({ repo: 'o/r', storage: createMemoryStorage(), fetch: github(releaseJson(32)) });
    const release = releaseFrom(releaseJson(32))!;
    await updates.install(release);
    expect(nativeState.calls).toEqual([`update-download:${release.apkUrl}:${SHA}`, 'update-install:/cache/updates/update.apk']);
    expect(updates.store.getState().status.phase).toBe('installing');

    nativeState.calls = [];
    nativeState.updateVerdict = 'other-key';
    await updates.install(release);
    expect(nativeState.calls).not.toContain('update-install:/cache/updates/update.apk');
    expect(updates.store.getState().status).toMatchObject({ phase: 'failed', message: expect.stringMatching(/different key/) });

    nativeState.canInstall = false;
    await updates.install(release);
    expect(updates.store.getState().status.phase).toBe('permission');
  });

  it('the dialog asks, then installs; without permission it opens the settings', async () => {
    const release = releaseFrom(releaseJson(32))!;
    updater.store.setState({ prompt: true, status: { phase: 'available', release } });
    await render(<UpdateDialog />);
    expect(screen.getByText(/Version 32 is available \(you have 31\)/)).toBeTruthy();

    nativeState.canInstall = false;
    await act(async () => fireEvent.press(screen.getByTestId('update-install')));
    await fireEvent.press(screen.getByTestId('update-settings'));
    expect(nativeState.calls).toContain('update-settings');

    nativeState.canInstall = true;
    await act(async () => fireEvent.press(screen.getByTestId('update-install')));
    expect(nativeState.calls).toContain('update-install:/cache/updates/update.apk');
    expect(screen.getByText(/Android asks you to confirm/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('update-close'));
    expect(screen.queryByTestId('update-dialog')).toBeNull();
  });
});
