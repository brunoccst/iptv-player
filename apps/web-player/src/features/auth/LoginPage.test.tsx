// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDirectApiClient, createSessionStore, createMemoryStorage, createAppHooks } from '@iptv/shared';
import { setScreenHost, type ScreenHost } from '@iptv/screens';
import { ReactNode } from 'react';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');

describe('LoginPage', () => {
  let hostCleanup: () => void;

  beforeEach(() => {
    // Create a minimal screenHost for the login screen
    const storage = createMemoryStorage();
    const api = createDirectApiClient({
      appName: 'Test App',
      secureStorage: storage,
      dataStorage: storage,
      // fetch will be stubbed globally by the test
      userAgent: 'test-agent',
    });
    const sessionStore = createSessionStore({ api, storage });
    const hooks = createAppHooks({ api, stores: { session: sessionStore }, reloadLists: vi.fn() });

    const host: ScreenHost = {
      hooks: { useSession: hooks.useSession },
      api,
      subtitles: { settings: { getState: () => ({ load: vi.fn() }) } },
      stores: { session: sessionStore },
      providerUserAgent: 'test-agent',
      openDetails: vi.fn(),
      play: vi.fn(),
      openSection: vi.fn(),
      signIn: {
        appName: 'Test App',
        note: () => null,
        chooseLanguage: vi.fn(),
        Restore: ({ onClose }: { onClose: () => void }) => { onClose(); return null; },
      },
      about: { rows: () => [] },
      backup: {
        storages: { secure: storage, data: storage },
        fileName: () => 'test.backup',
        contents: () => 'test',
        save: async () => null,
        pick: async () => null,
        restored: async () => {},
        failure: () => 'failed',
      },
      account: { backup: { label: () => 'Backup', run: vi.fn() }, log: { run: vi.fn() }, goHome: vi.fn() },
      profiles: { signOut: vi.fn() },
      useDownloads: () => ({ entries: [], notes: [] }),
      useSearch: () => ({ text: '' }),
      useCategory: () => null,
      setCategory: vi.fn(),
      details: {
        close: vi.fn(),
        useRevision: () => 0,
        useDownload: () => null,
        useExternalPlayer: () => null,
        replace: vi.fn(),
        Frame: ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
          <div data-testid="details-frame" onKeyDown={(e) => e.key === 'Escape' && onClose()}>{children}</div>
        ),
      },
      Page: ({ children, testID }: { children: ReactNode; testID: string }) => <div data-testid={testID}>{children}</div>,
      MenuTrigger: ({ children, onOpen }: { children: () => ReactNode; onOpen: () => void }) => (
        <div onContextMenu={(e) => { e.preventDefault(); onOpen(); }}>{children()}</div>
      ),
      EndSensor: ({ onReached }: { onReached: () => void }) => <div data-testid="end-sensor" onClick={onReached} />,
    };

    setScreenHost(host);
    // Store cleanup function
    hostCleanup = () => setScreenHost(null as unknown as ScreenHost);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    hostCleanup?.();
  });

  it('signs in with the provider directly and shows its refusal in plain language (D-088)', async () => {
    const { createFakePanel } = await import('../../../../../packages/shared/src/testing/fakePanel');
    const panel = createFakePanel();
    vi.stubGlobal('fetch', panel.fetch);
    const { LoginPage } = await import('./LoginPage');

    render(<LoginPage />);
    expect(screen.queryByText('My server')).toBeNull();
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'http://panel.test:8080' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    // The first sign-in also sets up the device's storage: allow more than the default second on a busy machine.
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveProperty('textContent', 'Your IPTV provider rejected this username or password.');
    expect(panel.calls.length).toBeGreaterThan(0);
    expect(panel.calls.every((url) => url.startsWith('http://panel.test:8080/player_api.php?'))).toBe(true);
  });
});
