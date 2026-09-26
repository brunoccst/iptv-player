import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createMemoryStorage } from '@iptv/shared';
import { updater } from '../appContext';
import { nativeState } from '../../test/tvMediaMock';
import { createUpdater, releaseFrom, shortVersion, versionLabel } from './updates';
import { UpdateDialog } from './UpdateDialog';

const SHA = 'a'.repeat(64);
const releaseJson = (version: number) => ({
  body: `TV app 1.0.${version - 31}. Built from abc1234 (push), version ${version}, signed with the release key, FFmpeg audio: true.`,
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
      versionName: '1.0.1',
      apkUrl: 'https://github.com/o/r/releases/download/tv-apk/tv.apk',
      sha256: SHA,
      publishedAt: '2026-09-26T12:00:00Z',
    });
    expect(releaseFrom({ body: 'no version here', assets: releaseJson(1).assets })).toBeNull();
    expect(releaseFrom({ ...releaseJson(32), assets: [] })).toBeNull();
    expect(releaseFrom(null)).toBeNull();
    // Releases from before version names: the build number only.
    expect(releaseFrom({ ...releaseJson(32), body: 'Built from abc (push), version 32, signed…' })).toMatchObject({
      versionCode: 32,
      versionName: null,
    });
  });

  it('shows MAJOR.MINOR.PATCH with the build number; older builds by number (D-070)', () => {
    expect(versionLabel({ versionCode: 57, versionName: '1.2.3' })).toBe('1.2.3 (build 57)');
    expect(shortVersion({ versionCode: 57, versionName: '1.2.3' })).toBe('1.2.3');
    expect(versionLabel({ versionCode: 55, versionName: '0.0.0' })).toBe('build 55');
    expect(shortVersion({ versionCode: 55, versionName: null })).toBe('build 55');
    expect(versionLabel(null)).toBe('unknown');
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

    // Asked from the menu, the dialog stays open with the answer until the user closes it.
    current.open();
    await current.check();
    expect(current.store.getState()).toMatchObject({ prompt: true, status: { phase: 'current' } });

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
    // The installer did not show up: open it again, without a new download.
    await updates.reopenInstaller();
    expect(nativeState.calls).toEqual([
      `update-download:${release.apkUrl}:${SHA}`,
      'update-install:/cache/updates/update.apk',
      'update-install:/cache/updates/update.apk',
    ]);

    nativeState.calls = [];
    nativeState.updateVerdict = 'other-key';
    await updates.install(release);
    expect(nativeState.calls).not.toContain('update-install:/cache/updates/update.apk');
    expect(updates.store.getState().status).toMatchObject({ phase: 'failed', message: expect.stringMatching(/different key/) });

    nativeState.canInstall = false;
    await updates.install(release);
    expect(updates.store.getState().status.phase).toBe('permission');
  });

  it('Check for updates without a newer version says so and waits for OK', async () => {
    updater.store.setState({ prompt: true, status: { phase: 'current' } });
    await render(<UpdateDialog />);
    expect(screen.getByText('No update available: you have the newest version, 1.0.0.')).toBeTruthy();
    await fireEvent.press(screen.getByText('OK'));
    expect(screen.queryByTestId('update-dialog')).toBeNull();
  });

  it('the dialog asks, then installs; without permission it opens the settings', async () => {
    const release = releaseFrom(releaseJson(32))!;
    updater.store.setState({ prompt: true, status: { phase: 'available', release } });
    await render(<UpdateDialog />);
    expect(screen.getByText(/Version 1.0.1 is available \(you have 1.0.0\)/)).toBeTruthy();

    nativeState.canInstall = false;
    await act(async () => fireEvent.press(screen.getByTestId('update-install')));
    await fireEvent.press(screen.getByTestId('update-settings'));
    expect(nativeState.calls).toContain('update-settings');

    nativeState.canInstall = true;
    await act(async () => fireEvent.press(screen.getByTestId('update-install')));
    expect(nativeState.calls).toContain('update-install:/cache/updates/update.apk');
    expect(screen.getByText(/Android asks you to confirm/)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('update-reopen')));
    expect(nativeState.calls.filter((call) => call.startsWith('update-install'))).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('update-close'));
    expect(screen.queryByTestId('update-dialog')).toBeNull();
  });
});
