import { createStore } from 'zustand/vanilla';
import { appLog, errorMessage, type KeyValueStorage } from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';

/**
 * Self-update (D-062). The app is only installed from this repository's `tv-apk` GitHub release, so it checks that
 * release for a newer build, downloads the APK and hands it to the Android installer (the user confirms there).
 */
export interface Release {
  versionCode: number;
  apkUrl: string;
  /** Hex SHA-256 GitHub reports for the file, when it does. */
  sha256: string | null;
  publishedAt: string | null;
}

export type UpdateStatus =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'current' }
  | { phase: 'available'; release: Release }
  | { phase: 'downloading'; release: Release; progress: number | null }
  | { phase: 'installing'; release: Release }
  /** The user must allow this app to install apps first (Android 8+). */
  | { phase: 'permission'; release: Release }
  | { phase: 'failed'; release: Release | null; message: string };

export const RELEASE_TAG = 'tv-apk';
const APK_NAME = 'tv.apk';
const SKIPPED_KEY = 'update.skipped';

/** The GitHub release JSON → what the app needs. `null` when it has no APK or no version in its notes. */
export function releaseFrom(json: unknown): Release | null {
  const release = json as {
    body?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    assets?: { name?: string; browser_download_url?: string; digest?: string | null; state?: string }[];
  } | null;
  const version = /\bversion (\d+)\b/.exec(release?.body ?? '')?.[1];
  const asset = release?.assets?.find((a) => a.name === APK_NAME && a.browser_download_url && (a.state ?? 'uploaded') === 'uploaded');
  if (!version || !asset) return null;
  const sha256 = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? '')?.[1] ?? null;
  return {
    versionCode: Number(version),
    apkUrl: asset.browser_download_url!,
    sha256,
    publishedAt: release?.updated_at ?? release?.published_at ?? null,
  };
}

export function createUpdater({
  repo,
  storage,
  fetch: fetchImpl = (...args) => fetch(...args),
}: {
  repo: string;
  storage: KeyValueStorage;
  fetch?: typeof fetch;
}) {
  const store = createStore<{
    status: UpdateStatus;
    /** Shown on its own (not only from the menu): an automatic check found a version the user did not skip. */
    prompt: boolean;
  }>()(() => ({ status: { phase: 'idle' }, prompt: false }));
  const set = (status: UpdateStatus, prompt = store.getState().prompt) => store.setState({ status, prompt });

  const installed = () => {
    try {
      return TvMedia.installedVersion().versionCode;
    } catch {
      return 0;
    }
  };

  /** `automatic`: at start-up; it only prompts for a version the user did not skip with "Later". */
  async function check(automatic = false): Promise<void> {
    if (!repo) return;
    const phase = store.getState().status.phase;
    if (phase === 'checking' || phase === 'downloading' || phase === 'installing') return;
    set({ phase: 'checking' });
    try {
      const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases/tags/${RELEASE_TAG}`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw new Error(`GitHub answered HTTP ${response.status}`);
      const release = releaseFrom(await response.json());
      const current = installed();
      if (!release || release.versionCode <= current) {
        appLog.info('update', `no update (installed ${current}, release ${release?.versionCode ?? 'none'})`);
        return set({ phase: 'current' }, false);
      }
      const skipped = Number(await storage.getItem(SKIPPED_KEY));
      appLog.info('update', `version ${release.versionCode} available (installed ${current})`);
      set({ phase: 'available', release }, !automatic || skipped !== release.versionCode);
    } catch (error) {
      appLog.warn('update', `check failed: ${errorMessage(error)}`);
      // A failed automatic check stays quiet.
      set(
        automatic ? { phase: 'idle' } : { phase: 'failed', release: null, message: 'Could not check for updates. Try again later.' },
        !automatic,
      );
    }
  }

  /** Downloads, checks and opens the installer. */
  async function install(release: Release): Promise<void> {
    if (!TvMedia.canInstallUpdates()) return set({ phase: 'permission', release });
    set({ phase: 'downloading', release, progress: 0 });
    const subscription = TvMedia.addListener('onUpdateProgress', ({ bytes, total }) => {
      const status = store.getState().status;
      if (status.phase === 'downloading') set({ ...status, progress: total > 0 ? bytes / total : null });
    });
    try {
      const path = await TvMedia.downloadUpdate(release.apkUrl, release.sha256);
      const verdict = TvMedia.checkUpdate(path);
      appLog.info('update', `downloaded version ${release.versionCode}: ${verdict}`);
      if (verdict === 'ok') {
        set({ phase: 'installing', release });
        TvMedia.installUpdate(path);
      } else set({ phase: 'failed', release, message: verdictMessage(verdict) });
    } catch (error) {
      appLog.warn('update', `download failed: ${errorMessage(error)}`);
      set({ phase: 'failed', release, message: 'The download failed. Check the connection and try again.' });
    } finally {
      subscription.remove();
    }
  }

  /** "Later": no automatic prompt for this version again (the menu still offers it). */
  async function later(): Promise<void> {
    const { status } = store.getState();
    if (status.phase === 'available') await storage.setItem(SKIPPED_KEY, String(status.release.versionCode));
    store.setState({ prompt: false });
  }

  const dismiss = () => store.setState({ prompt: false });
  const open = () => store.setState({ prompt: true });

  return { store, check, install, later, dismiss, open };
}

export type Updater = ReturnType<typeof createUpdater>;

function verdictMessage(verdict: string): string {
  switch (verdict) {
    case 'other-key':
      return (
        'This version is signed with a different key than the installed app, so Android cannot install it over it. ' +
        'Back up your data (account menu → Back up data), uninstall the app, install the new version, then restore the backup.'
      );
    case 'not-newer':
      return 'The new version is still being published. Try again in a few minutes.';
    default:
      return 'The downloaded file is not an update of this app.';
  }
}
