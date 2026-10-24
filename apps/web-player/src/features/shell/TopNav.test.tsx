// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenHostProvider, type ScreenHost } from '@iptv/screens';

const profile = { id: 'p1', name: 'Bruno', isKids: false };
const state = { view: 'home', search: '', profiles: [profile], activeProfileId: 'p1', status: 'none' };
vi.mock('../../appContext', () => ({ uiStore: { getState: () => ({ navigate: vi.fn(), setSearch: vi.fn() }) } }));
vi.mock('../../hooks/stores', () => ({
  useSession: (select: (s: typeof state) => unknown) => select(state),
  useUi: (select: (s: typeof state) => unknown) => select(state),
}));
vi.mock('../browse/screenHost', () => ({}));
vi.mock('@iptv/shared', async (original) => ({
  ...(await original<typeof import('@iptv/shared')>()),
  selectActiveProfile: () => profile,
}));

// What the shared account menu reads from the desktop; the dialogs it opens are not under test.
const host = {
  hooks: {
    useSession: (select: (s: typeof state) => unknown) => select(state),
    usePin: (select: (s: typeof state) => unknown) => select(state),
  },
  stores: { session: { getState: () => ({ selectProfile: vi.fn() }) }, library: { getState: () => ({ sync: vi.fn() }) } },
  signIn: { appName: 'Player' },
  about: { rows: () => [] },
  profiles: { usePinGate: () => ({ gate: vi.fn(), dialog: null }), signOut: vi.fn() },
  account: {
    backup: { label: () => 'Back up & restore', Dialog: () => null },
    log: { Dialog: () => null },
    goHome: vi.fn(),
  },
} as unknown as ScreenHost;

describe('account menu (issue #155)', () => {
  afterEach(cleanup);

  const open = async (value: ScreenHost = host) => {
    const { TopNav } = await import('./TopNav');
    render(
      <ScreenHostProvider value={value}>
        <TopNav />
      </ScreenHostProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    return screen.getByRole('menu');
  };

  it('stays open when the mouse leaves it, and in a group', async () => {
    const menu = await open();
    fireEvent.mouseLeave(menu);
    fireEvent.mouseOut(menu);
    fireEvent.click(screen.getByRole('menuitem', { name: 'App' }));
    expect(screen.getByRole('menu').textContent).toContain('About');
  });

  it('closes on a click beside it, not on a click inside', async () => {
    const menu = await open();
    fireEvent.click(menu);
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Close menu'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and gives the focus back to the avatar', async () => {
    await open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Account menu' }));
  });

  it('the avatar still toggles it closed', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('App → Start with the computer shows the setting and turns it on (issue #309)', async () => {
    const set = vi.fn(async (on: boolean) => on);
    await open({ ...host, account: { ...host.account, startup: { get: async () => false, set } } } as ScreenHost);
    fireEvent.click(screen.getByRole('menuitem', { name: 'App' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Start with the computer' }));
    const toggle = await screen.findByRole('checkbox', { name: 'Start with the computer' });
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    fireEvent.click(toggle);
    expect(set).toHaveBeenCalledWith(true);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
  });

  it('has no start-up item where the app cannot start with the computer', async () => {
    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'App' }));
    expect(screen.queryByRole('menuitem', { name: 'Start with the computer' })).toBeNull();
  });
});
