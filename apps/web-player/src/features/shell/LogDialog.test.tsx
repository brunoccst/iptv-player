// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@iptv/shared';
import { setScreenHost, type ScreenHost } from '@iptv/screens';
import { ReactNode } from 'react';

vi.mock('../../config', () => ({ appConfig: { appName: 'Player', appSlug: 'player' }, providerUserAgent: 'test-agent' }));
vi.mock('../../desktop', () => ({ desktop: null }));

describe('log dialog', () => {
  let hostCleanup: () => void;

  beforeEach(() => {
    const storage = createMemoryStorage();
    const host: ScreenHost = {
      hooks: {},
      api: {} as ScreenHost['api'],
      subtitles: { settings: { getState: () => ({ load: vi.fn() }) } },
      stores: {},
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
      useNavFocusTarget: () => undefined,
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
    hostCleanup = () => setScreenHost(null as unknown as ScreenHost);
  });

  afterEach(() => {
    cleanup();
    hostCleanup?.();
  });

  it('closes with the X at its top right (D-237)', async () => {
    const { LogDialog } = await import('./LogDialog');
    const onClose = vi.fn();
    render(<LogDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
