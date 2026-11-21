import { createFakeBackend, createFakeApi, createTestAppContext } from '@iptv/shared/testing';
import { createAppHooks } from '@iptv/shared';
import { createSessionStore } from '@iptv/shared';
import { createCatalogStore } from '@iptv/shared';
import { createLibraryStore } from '@iptv/shared';
import { createProfilePrefsStore } from '@iptv/shared';
import { createProgressStore } from '@iptv/shared';
import { createWatchlistStore } from '@iptv/shared';
import { createPinStore } from '@iptv/shared';
import { createNewSeasonsStore } from '@iptv/shared';
import { createMemoryStorage } from '@iptv/shared';
import type { ScreenHost } from '@iptv/screens';
import { ReactNode } from 'react';

/**
 * Creates a minimal ScreenHost for testing shared screens.
 * Provides the hooks and stores that shared screens expect.
 */
export function createTestScreenHost(overrides: Partial<ScreenHost> = {}): ScreenHost {
  const backend = createFakeBackend();
  const api = createFakeApi(backend);
  const storage = createMemoryStorage();

  const sessionStore = createSessionStore({ api, storage });
  const catalogStore = createCatalogStore({ api });
  const libraryStore = createLibraryStore({ api });
  const profilePrefsStore = createProfilePrefsStore({ storage });
  const progressStore = createProgressStore({ api });
  const watchlistStore = createWatchlistStore({ api });
  const pinStore = createPinStore({ storage });
  const newSeasonsStore = createNewSeasonsStore({ api });

  const stores = {
    session: sessionStore,
    catalog: catalogStore,
    library: libraryStore,
    profilePrefs: profilePrefsStore,
    progress: progressStore,
    watchlist: watchlistStore,
    pin: pinStore,
    newSeasons: newSeasonsStore,
  };

  const hooks = createAppHooks({
    api,
    stores,
    reloadLists: vi.fn(),
  });

  const context = createTestAppContext({ backend, storage });

  return {
    hooks,
    api,
    subtitles: context.subtitles,
    stores,
    providerUserAgent: 'test-agent',
    openDetails: vi.fn(),
    play: vi.fn(),
    openSection: vi.fn(),
    signIn: {
      appName: 'Test App',
      note: () => null,
      chooseLanguage: vi.fn(),
      Restore: ({ onClose }) => {
        onClose();
        return null;
      },
      ...overrides.signIn,
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
    account: {
      backup: { label: () => 'Backup', run: vi.fn() },
      log: { run: vi.fn() },
      goHome: vi.fn(),
    },
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
        <div data-testid="details-frame" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
          {children}
        </div>
      ),
    },
    Page: ({ children, testID }) => <div data-testid={testID}>{children}</div>,
    MenuTrigger: ({ children, onOpen }) => (
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          onOpen();
        }}
      >
        {children()}
      </div>
    ),
    EndSensor: ({ onReached }) => <div data-testid="end-sensor" onClick={onReached} />,
    ...overrides,
  };
}

/**
 * Sets up the ScreenHostProvider for testing.
 * Call this in a test's beforeEach or at the top of the test file.
 */
export function setupTestScreenHost(overrides: Partial<ScreenHost> = {}) {
  const host = createTestScreenHost(overrides);
  const { ScreenHostProvider } = await import('@iptv/screens');

  return {
    host,
    ScreenHostProvider,
    wrapper: ({ children }: { children: ReactNode }) => <ScreenHostProvider value={host}>{children}</ScreenHostProvider>,
  };
}
